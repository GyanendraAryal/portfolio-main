"""
LangGraph agent definition.

Graph topology:
  START → validate_input → [route]
    "canned"   → END  (returns state.answer directly)
    "classify" → classify_intent → [route]
      "canned"   → END
      "retrieve" → retrieve → [route]
        "canned" → END
        "grade"  → grade_context → [route]
          "canned"   → END
          "generate" → generate → [route]
            "canned"      → END
            "postprocess" → postprocess → END

State is persisted in-process via MemorySaver, keyed by session_id (thread_id).
"""

from __future__ import annotations

import functools
import logging

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from .nodes import (
    classify_intent,
    generate,
    grade_context,
    postprocess,
    retrieve,
    validate_input,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State schema
# ---------------------------------------------------------------------------

class ChatState(TypedDict, total=False):
    message: str
    session_id: str
    active_version: str
    route: str
    answer: str
    chunks: list
    tokens: list
    cache_hit: bool
    streaming_token: str


# ---------------------------------------------------------------------------
# Router helpers
# ---------------------------------------------------------------------------

def _route(state: ChatState) -> str:
    return state.get("route", "canned")


def _inject_active_version(state: ChatState) -> ChatState:
    """
    Middleware node: load the current active resume version from Postgres
    and inject it into state before retrieval begins.
    """
    from portfolio.models import ResumeIndexState

    index_state = ResumeIndexState.objects.filter(pk=1).first()
    if index_state and index_state.status in ("idle",) and index_state.active_version:
        return {**state, "active_version": index_state.active_version}

    # Index is unavailable (indexing / failed / never run)
    return {**state, "active_version": ""}


# ---------------------------------------------------------------------------
# Build the graph (cached singleton)
# ---------------------------------------------------------------------------

@functools.lru_cache(maxsize=1)
def get_graph():
    memory = MemorySaver()
    builder = StateGraph(ChatState)

    # Nodes
    builder.add_node("validate_input", validate_input)
    builder.add_node("inject_version", _inject_active_version)
    builder.add_node("classify_intent", classify_intent)
    builder.add_node("retrieve", retrieve)
    builder.add_node("grade_context", grade_context)
    builder.add_node("generate", generate)
    builder.add_node("postprocess", postprocess)

    # Edges
    builder.add_edge(START, "validate_input")

    builder.add_conditional_edges(
        "validate_input",
        _route,
        {"canned": END, "classify": "inject_version"},
    )

    builder.add_conditional_edges(
        "inject_version",
        lambda s: "classify",  # always proceed
        {"classify": "classify_intent"},
    )

    builder.add_conditional_edges(
        "classify_intent",
        _route,
        {"canned": END, "retrieve": "retrieve"},
    )

    builder.add_conditional_edges(
        "retrieve",
        _route,
        {"canned": END, "grade": "grade_context"},
    )

    builder.add_conditional_edges(
        "grade_context",
        _route,
        {"canned": END, "generate": "generate"},
    )

    builder.add_conditional_edges(
        "generate",
        _route,
        {"canned": END, "postprocess": "postprocess"},
    )

    builder.add_edge("postprocess", END)

    return builder.compile(checkpointer=memory)
