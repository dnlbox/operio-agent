"""API routes for documents and manuals search endpoints."""

from typing import Any, Optional
from fastapi import APIRouter, Depends
from pymongo.database import Database

from operio_agent.api.deps import get_db

router = APIRouter()

LEASES_SEARCH_INDEX = "leases_search"
MANUALS_SEARCH_INDEX = "manuals_search"
DOCS_SEARCH_LIMIT = 4


def _run_atlas_search(
    db: Database,
    collection_name: str,
    index_name: str,
    query: str,
    filter_field: Optional[str],
    filter_value: Optional[str],
) -> list[dict[str, Any]]:
    """Executes a MongoDB Atlas Search aggregation on the given collection.

    Args:
        db: The active MongoDB database.
        collection_name: Collection to search (e.g. 'leases', 'manuals').
        index_name: Atlas Search index name.
        query: Free-text search query.
        filter_field: Optional field name to filter on (exact token match).
        filter_value: Optional value for the filter field.

    Returns:
        list[dict[str, Any]]: Matching documents with a 'score' field.
    """
    must_clause: list[dict[str, Any]] = [
        {
            "text": {
                "query": query,
                "path": ["content", "title"],
                "fuzzy": {},
            }
        }
    ]

    filter_clauses: list[dict[str, Any]] = []
    if filter_field and filter_value:
        filter_clauses.append(
            {"text": {"query": filter_value, "path": filter_field}}
        )

    search_stage: dict[str, Any] = {
        "$search": {
            "index": index_name,
            "compound": {"must": must_clause},
        }
    }
    if filter_clauses:
        search_stage["$search"]["compound"]["filter"] = filter_clauses

    pipeline: list[dict[str, Any]] = [
        search_stage,
        {"$limit": DOCS_SEARCH_LIMIT},
        {
            "$project": {
                "_id": 1,
                "leaseId": 1,
                "equipmentModel": 1,
                "title": 1,
                "content": 1,
                "pdfUrl": 1,
                "score": {"$meta": "searchScore"},
            }
        },
    ]

    return list(db[collection_name].aggregate(pipeline))


@router.get("/docs/search")
def search_docs(
    query: str,
    type: Optional[str] = None,
    leaseId: Optional[str] = None,
    equipmentModel: Optional[str] = None,
    db: Database = Depends(get_db),
) -> list[dict[str, Any]]:
    """Exposes Atlas Search query matches directly to the Knowledge Inspector.

    Args:
        query: The search text query.
        type: Document type filter ('leases', 'manuals', 'all').
        leaseId: Optional lease ID to filter search results.
        equipmentModel: Optional equipment model to filter search results.
        db: Injected MongoDB database connection.

    Returns:
        list[dict[str, Any]]: Combined list of relevance-sorted document hits.
    """
    if type and type.lower() == "all":
        type = None

    hits: list[dict[str, Any]] = []

    if not type or type == "leases":
        lease_filter_value = (
            leaseId if leaseId and leaseId.lower() != "all" else None
        )
        try:
            rows = _run_atlas_search(
                db,
                collection_name="leases",
                index_name=LEASES_SEARCH_INDEX,
                query=query,
                filter_field="leaseId" if lease_filter_value else None,
                filter_value=lease_filter_value,
            )
            for row in rows:
                hits.append(
                    {
                        "id": str(row["_id"]),
                        "type": "leases",
                        "title": row.get("title"),
                        "content": row.get("content"),
                        "pdfUrl": row.get("pdfUrl"),
                        "leaseId": row.get("leaseId"),
                        "score": row.get("score"),
                    }
                )
        except Exception as e:
            print(f"[Search API] Leases query failed: {e}")

    if not type or type == "manuals":
        model_filter_value = (
            equipmentModel
            if equipmentModel and equipmentModel.lower() != "all"
            else None
        )
        try:
            rows = _run_atlas_search(
                db,
                collection_name="manuals",
                index_name=MANUALS_SEARCH_INDEX,
                query=query,
                filter_field="equipmentModel" if model_filter_value else None,
                filter_value=model_filter_value,
            )
            for row in rows:
                hits.append(
                    {
                        "id": str(row["_id"]),
                        "type": "manuals",
                        "title": row.get("title"),
                        "content": row.get("content"),
                        "pdfUrl": row.get("pdfUrl"),
                        "equipmentModel": row.get("equipmentModel"),
                        "score": row.get("score"),
                    }
                )
        except Exception as e:
            print(f"[Search API] Manuals query failed: {e}")

    hits.sort(key=lambda x: x.get("score") or 0, reverse=True)
    return hits
