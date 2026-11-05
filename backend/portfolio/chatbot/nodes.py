"""
LangGraph node functions for the resume chatbot.

Node order:
  validate_input → classify_intent → retrieve → grade_context → generate → postprocess

Each node receives and returns the full graph State dict.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from django.conf import settings

from .prompts import (
    GREETING_RESPONSE,
    INDEX_UNAVAILABLE_RESPONSE,
    NOT_IN_RESUME_RESPONSE,
    SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)

MAX_INPUT_CHARS = 500
MAX_ANSWER_CHARS = 1500

# ── Prompt-injection / abuse patterns ────────────────────────────────────────
_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.I),
    re.compile(r"reveal\s+(your\s+)?(system\s+)?prompt", re.I),
    re.compile(r"you\s+are\s+now\s+a", re.I),
    re.compile(r"act\s+as\s+(if\s+you\s+are|a\s+different)", re.I),
    re.compile(r"pretend\s+(to\s+be|you\s+are)", re.I),
    re.compile(r"jailbreak", re.I),
    re.compile(r"DAN\b", re.I),  # "Do Anything Now" jailbreak
]

# ── Intent classifier keywords ────────────────────────────────────────────────
_GREETING_WORDS = {"hi", "hello", "hey", "howdy", "greetings", "good morning", "good afternoon", "sup"}
_SENSITIVE_WORDS = {
    "salary", "pay", "compensation", "address", "phone", "relationship",
    "girlfriend", "boyfriend", "wife", "husband", "health", "medical",
    "religion", "politics", "personal life",
}
_HOSTILE_WORDS = {
    "fuck", "shit", "bitch", "asshole", "idiot", "stupid", "kill",
    "hate", "racist", "nsfw", "sex", "nude", "porn",
}
_IMPERSONATION_WORDS = {
    "write a cover letter", "write an email", "pretend to be",
    "be me", "speak as me", "as the owner",
}
_OFF_TOPIC_SIGNALS = {
    "weather", "stock", "bitcoin", "recipe", "movie", "game", "sport",
    "news", "politics", "math problem", "code for me", "write a function",
    "translate", "what is the capital",
}


# ---------------------------------------------------------------------------
# Node: validate_input
# ---------------------------------------------------------------------------

def validate_input(state: dict) -> dict:
    message: str = state.get("message", "").strip()

    if not message:
        return {**state, "route": "canned", "answer": "Please type a message to get started."}

    if len(message) > MAX_INPUT_CHARS:
        return {
            **state,
            "route": "canned",
            "answer": f"Your message is too long. Please keep it under {MAX_INPUT_CHARS} characters.",
        }

    # Emoji-only or very short non-word input
    if re.fullmatch(r"[\W\d\s]+", message):
        return {
            **state,
            "route": "canned",
            "answer": "Could you rephrase that as a question? I'm here to help with resume questions.",
        }

    # Prompt injection / jailbreak
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(message):
            return {**state, "route": "canned", "answer": "I'm not able to help with that."}

    return {**state, "route": "classify", "message": message}


# ---------------------------------------------------------------------------
# Node: classify_intent
# ---------------------------------------------------------------------------

def classify_intent(state: dict) -> dict:
    message = state.get("message", "").lower()

    # Greeting
    words = set(re.split(r"\W+", message))
    if words & _GREETING_WORDS and len(message) < 30:
        return {**state, "route": "canned", "answer": GREETING_RESPONSE}

    # Hostile / NSFW
    if any(hw in message for hw in _HOSTILE_WORDS):
        return {**state, "route": "canned", "answer": "I'm not able to help with that."}

    # Impersonation request
    if any(imp in message for imp in _IMPERSONATION_WORDS):
        return {
            **state,
            "route": "canned",
            "answer": (
                "I can't write on behalf of or impersonate the portfolio owner. "
                "I can summarise their experience or skills if that would help."
            ),
        }

    # Sensitive personal topics
    if any(sw in message for sw in _SENSITIVE_WORDS):
        return {
            **state,
            "route": "canned",
            "answer": (
                "That information isn't covered in the resume. "
                "Feel free to reach out via the contact form for anything personal."
            ),
        }

    # Off-topic
    if any(ot in message for ot in _OFF_TOPIC_SIGNALS):
        return {
            **state,
            "route": "canned",
            "answer": (
                "I can only answer questions about this portfolio owner's resume. "
                "Try asking about their skills, experience, or projects."
            ),
        }

    return {**state, "route": "retrieve"}


# ---------------------------------------------------------------------------
# Node: retrieve
# ---------------------------------------------------------------------------

def retrieve(state: dict) -> dict:
    from .cache import get_cached_answer
    from .embedder import embed_query
    from .qdrant_store import query_chunks

    # Check index availability
    active_version = state.get("active_version", "")
    if not active_version:
        return {
            **state,
            "route": "canned",
            "answer": INDEX_UNAVAILABLE_RESPONSE,
        }

    message = state.get("message", "")

    # App-side response cache hit
    cached = get_cached_answer(message, active_version)
    if cached:
        return {**state, "route": "canned", "answer": cached, "cache_hit": True}

    try:
        vector = embed_query(message)
        chunks = query_chunks(vector, active_version)
    except Exception as exc:
        logger.error("Retrieval error: %s", exc, exc_info=True)
        return {
            **state,
            "route": "canned",
            "answer": "I'm having trouble searching the resume right now. Please try again in a moment.",
        }

    return {**state, "chunks": chunks, "route": "grade"}


# ---------------------------------------------------------------------------
# Node: grade_context
# ---------------------------------------------------------------------------

def grade_context(state: dict) -> dict:
    chunks: list[dict] = state.get("chunks", [])

    if not chunks:
        return {**state, "route": "canned", "answer": NOT_IN_RESUME_RESPONSE}

    # All chunks below threshold were already filtered by Qdrant score_threshold.
    # Double-check: if the best score is low even after threshold, refuse.
    best_score = max(c.get("score", 0.0) for c in chunks)
    if best_score < 0.30:
        return {**state, "route": "canned", "answer": NOT_IN_RESUME_RESPONSE}

    return {**state, "route": "generate"}


# ---------------------------------------------------------------------------
# Node: generate
# ---------------------------------------------------------------------------

def generate(state: dict) -> dict:
    from langchain_groq import ChatGroq

    chunks: list[dict] = state.get("chunks", [])
    message: str = state.get("message", "")

    # Build context string from retrieved chunks
    context_parts = []
    for chunk in chunks:
        section = chunk.get("section", "").title()
        text = chunk.get("text", "")
        context_parts.append(f"[{section}]\n{text}")
    context = "\n\n---\n\n".join(context_parts)

    system_prompt = SYSTEM_PROMPT.format(context=context)

    groq_api_key = getattr(settings, 'GROQ_API_KEY', '')
    llm = ChatGroq(
        model="openai/gpt-oss-120b",
        api_key=groq_api_key,
        temperature=0.1,
        max_tokens=800,
        streaming=True,
    )

    messages = [
        ("system", system_prompt),
        ("human", message),
    ]

    full_answer = ""
    tokens = []
    try:
        for chunk in llm.stream(messages):
            token = chunk.content
            if token:
                tokens.append(token)
                full_answer += token
    except Exception as exc:
        logger.error("Groq generation error: %s", exc, exc_info=True)
        return {
            **state,
            "route": "canned",
            "answer": "The assistant is temporarily unavailable. Please try again shortly.",
        }

    return {
        **state,
        "route": "postprocess",
        "answer": full_answer,
        "tokens": tokens,
    }


# ---------------------------------------------------------------------------
# Node: postprocess
# ---------------------------------------------------------------------------

def postprocess(state: dict) -> dict:
    from .cache import set_cached_answer

    answer: str = state.get("answer", "")

    # Enforce length
    if len(answer) > MAX_ANSWER_CHARS:
        answer = answer[:MAX_ANSWER_CHARS].rsplit(" ", 1)[0] + "…"

    # Strip any leaked system-prompt artefacts
    answer = re.sub(r"<\|.*?\|>", "", answer)
    answer = answer.strip()

    if not answer:
        answer = "I wasn't able to generate a response. Please try again."

    # Cache the cleaned answer
    active_version = state.get("active_version", "")
    if active_version and not state.get("cache_hit"):
        set_cached_answer(state.get("message", ""), active_version, answer)

    return {**state, "answer": answer}
