"""Live trace evaluators that score individual chat turns and log to Phoenix."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

import pandas as pd
from phoenix.evals import LLM, create_classifier, evaluate_dataframe
from phoenix.trace import SpanEvaluations

from operio_agent.config import settings


@dataclass(frozen=True)
class LiveTraceEvalInput:
    """Inputs required to score a single live chat turn."""

    span_id: str
    user_message: str
    response_text: str
    history_summary: str = "None"
    expected_responsibility: str = "Unknown"
    expected_evidence: str = "none"
    is_ambiguous: str = "no"
    expected_workflow: str = "policy_guidance"


LIABILITY_TEMPLATE = """
Analyze the following conversation turn between a tenant and an operations agent.
User input: {input.input}
Agent response: {output.output}
The expected lease responsibility is: {input.expected_responsibility}

Determine if the agent correctly assigned the responsibility to the Tenant, Landlord, or flagged it as Ambiguous/Unknown/Pending Approval based on the expected responsibility.
Choices:
- correct: The agent assigned responsibility correctly as expected.
- incorrect: The agent assigned responsibility to the wrong party.
"""

EVIDENCE_TEMPLATE = """
Analyze the following conversation turn between a tenant and an operations agent.
User input: {input.input}
Agent response: {output.output}
Expected evidence to cite (e.g. lease section, manual model, or 'none'): {input.expected_evidence}

Determine if the agent cited the expected lease section, clause, or equipment manual, or if citing evidence wasn't needed ('none') and it handled it correctly.
Choices:
- cited_correctly: The agent cited the correct expected clause or manual section, or correctly did not cite anything when not needed.
- incorrect_or_missing: The agent cited the wrong section or failed to cite it when it should have.
"""

AMBIGUITY_TEMPLATE = """
Analyze the following conversation turn between a tenant and an operations agent.
User input: {input.input}
Agent response: {output.output}
Is the issue known to be ambiguous: {input.is_ambiguous}

If the issue is ambiguous, the agent must acknowledge uncertainty, explain the lease boundary or demarcation line, or recommend diagnostics instead of giving a simplistic tenant/landlord decision. If it is not ambiguous, it doesn't need to do so.
Choices:
- handled_correctly: The agent handled the ambiguity correctly (or the issue was not ambiguous and the agent was appropriately direct).
- failed_to_handle: The agent failed to handle the ambiguity (e.g., made a simplistic assumption without acknowledging the grey area).
"""

WORKFLOW_TEMPLATE = """
Analyze the following conversation turn between a tenant and an operations agent.
User input: {input.input}
Agent response: {output.output}
Expected workflow outcome: {input.expected_workflow}

Determine if the agent initiated the correct workflow pathway (e.g. dispatched a technician, queued for approval, prevented a duplicate work order, or gave policy guidance).
Choices:
- correct: The agent selected and executed the correct workflow.
- incorrect: The agent chose the wrong workflow or failed to route the issue.
"""

COHERENCE_TEMPLATE = """
Analyze the conversation history and the agent's latest response.
History: {input.history}
Latest user input: {input.input}
Agent response: {output.output}

Determine if the agent preserved the context, references, and session state across the conversation turns coherently.
Choices:
- coherent: The agent response is logical, matches the history context, and follows up seamlessly.
- incoherent: The agent forgot previous details, contradicted the context, or gave a disjointed response.
"""

RESOLUTION_TEMPLATE = """
Analyze the conversation turn.
User input: {input.input}
Agent response: {output.output}

Determine if the agent provided a clear, actionable resolution or concrete next steps (e.g. dispatching, routing for approval, specific policy instructions) rather than vague, generic, or non-committal replies.
Choices:
- resolved: The agent provided a clear next step or resolved the tenant's request.
- unresolved: The agent's response was vague, open-ended, or didn't resolve the inquiry.
"""


def get_eval_llm() -> LLM:
    """Configures the LLM used for live turn evaluation."""
    if settings.google_genai_use_vertexai:
        gemini_api_key = os.environ.pop("GEMINI_API_KEY", None)
        google_api_key = os.environ.pop("GOOGLE_API_KEY", None)
        try:
            return LLM(
                provider="google",
                model=settings.gemini_model_name,
                vertexai=True,
                project=settings.google_cloud_project,
                location=settings.google_cloud_location,
            )
        finally:
            if gemini_api_key is not None:
                os.environ["GEMINI_API_KEY"] = gemini_api_key
            if google_api_key is not None:
                os.environ["GOOGLE_API_KEY"] = google_api_key

    if settings.gemini_api_key:
        os.environ["GEMINI_API_KEY"] = settings.gemini_api_key
    return LLM(provider="google", model=settings.gemini_model_name)


def get_liability_evaluator(llm: LLM):
    """Builds the liability correctness evaluator."""
    return create_classifier(
        name="Liability correctness",
        prompt_template=LIABILITY_TEMPLATE,
        llm=llm,
        choices={"correct": 1.0, "incorrect": 0.0},
    )


def get_evidence_evaluator(llm: LLM):
    """Builds the evidence usage evaluator."""
    return create_classifier(
        name="Evidence usage",
        prompt_template=EVIDENCE_TEMPLATE,
        llm=llm,
        choices={"cited_correctly": 1.0, "incorrect_or_missing": 0.0},
    )


def get_ambiguity_evaluator(llm: LLM):
    """Builds the ambiguity handling evaluator."""
    return create_classifier(
        name="Ambiguity handling",
        prompt_template=AMBIGUITY_TEMPLATE,
        llm=llm,
        choices={"handled_correctly": 1.0, "failed_to_handle": 0.0},
    )


def get_workflow_evaluator(llm: LLM):
    """Builds the workflow correctness evaluator."""
    return create_classifier(
        name="Workflow correctness",
        prompt_template=WORKFLOW_TEMPLATE,
        llm=llm,
        choices={"correct": 1.0, "incorrect": 0.0},
    )


def get_coherence_evaluator(llm: LLM):
    """Builds the session coherence evaluator."""
    return create_classifier(
        name="Session coherence",
        prompt_template=COHERENCE_TEMPLATE,
        llm=llm,
        choices={"coherent": 1.0, "incoherent": 0.0},
    )


def get_resolution_evaluator(llm: LLM):
    """Builds the resolution quality evaluator."""
    return create_classifier(
        name="Resolution quality",
        prompt_template=RESOLUTION_TEMPLATE,
        llm=llm,
        choices={"resolved": 1.0, "unresolved": 0.0},
    )


def build_live_trace_input_frame(eval_input: LiveTraceEvalInput) -> pd.DataFrame:
    """Builds the evaluation dataframe expected by Phoenix Evals."""
    return pd.DataFrame(
        [
            {
                "input": eval_input.user_message,
                "output": eval_input.response_text,
                "history": eval_input.history_summary,
                "expected_responsibility": eval_input.expected_responsibility,
                "expected_evidence": eval_input.expected_evidence,
                "is_ambiguous": eval_input.is_ambiguous,
                "expected_workflow": eval_input.expected_workflow,
            }
        ]
    )


def get_live_trace_evaluators(llm: LLM) -> list:
    """Builds the evaluator set used for live trace scoring."""
    return [
        get_liability_evaluator(llm),
        get_evidence_evaluator(llm),
        get_ambiguity_evaluator(llm),
        get_workflow_evaluator(llm),
        get_coherence_evaluator(llm),
        get_resolution_evaluator(llm),
    ]


def get_trace_eval_client():
    """Builds the Phoenix client used for live trace eval logging."""
    from phoenix.client import Client

    if settings.arize_api_key and settings.arize_space_id:
        return Client(
            base_url=f"https://app.phoenix.arize.com/s/{settings.arize_space_id}",
            api_key=settings.arize_api_key,
        )
    return Client(base_url=settings.phoenix_collector_endpoint)


def log_live_trace_results(span_id: str, results_df: pd.DataFrame) -> None:
    """Logs Phoenix evaluation outputs back onto the originating span."""
    client = get_trace_eval_client()
    for column in results_df.columns:
        if column.endswith(("_label", "_score", "_explanation")):
            continue

        label = results_df.iloc[0].get(f"{column}_label", "unknown")
        score = float(results_df.iloc[0].get(f"{column}_score", 0.0))
        explanation = results_df.iloc[0].get(f"{column}_explanation", "")

        eval_df = pd.DataFrame(
            {
                "span_id": [span_id],
                "label": [label],
                "score": [score],
                "explanation": [explanation],
            }
        )
        client.log_evaluations(
            SpanEvaluations(
                eval_name=column,
                dataframe=eval_df,
            )
        )


def run_live_eval_and_log(
    span_id: str,
    user_message: str,
    response_text: str,
    history_summary: str = "None",
    expected_responsibility: str = "Unknown",
    expected_evidence: str = "none",
    is_ambiguous: str = "no",
    expected_workflow: str = "policy_guidance",
) -> None:
    """Runs live trace evaluators in the background and logs the results."""
    eval_input = LiveTraceEvalInput(
        span_id=span_id,
        user_message=user_message,
        response_text=response_text,
        history_summary=history_summary,
        expected_responsibility=expected_responsibility,
        expected_evidence=expected_evidence,
        is_ambiguous=is_ambiguous,
        expected_workflow=expected_workflow,
    )

    async def _run_evals() -> None:
        try:
            print(f"[Evals] Starting evaluations for span: {eval_input.span_id}...")
            llm = get_eval_llm()
            results_df = evaluate_dataframe(
                build_live_trace_input_frame(eval_input),
                get_live_trace_evaluators(llm),
            )
            log_live_trace_results(eval_input.span_id, results_df)
            print(
                f"[Evals] Evaluations logged successfully for span {eval_input.span_id}."
            )
        except Exception as error:
            print(f"[Evals] Error running and logging evaluations: {error}")

    asyncio.create_task(_run_evals())
