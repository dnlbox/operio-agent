"""API routes for documents and manuals search endpoints."""

from typing import Any, Optional
from fastapi import APIRouter, Depends
from pymongo.database import Database
from google import genai

from operio_agent.api.deps import get_db
from operio_agent.config import settings

router = APIRouter()

LEASES_SEARCH_INDEX = "leases_search"
MANUALS_SEARCH_INDEX = "manuals_search"
DOCS_SEARCH_LIMIT = 4


def _get_embedding(query: str) -> list[float] | None:
    """Generates embedding vector for the query text using Gemini Developer API."""
    try:
        api_key = settings.gemini_api_key
        if api_key:
            client = genai.Client(api_key=api_key)
            response = client.models.embed_content(
                model="models/gemini-embedding-2",
                contents=query
            )
            return response.embeddings[0].values
    except Exception as e:
        print(f"[Search API] Failed to generate embedding: {e}")
    return None


def _run_rag_search(
    db: Database,
    collection_name: str,
    query: str,
    filter_field: Optional[str],
    filter_value: Optional[str],
) -> list[dict[str, Any]]:
    """Executes a search on the given collection using multiple fallback strategies.

    Args:
        db: The active MongoDB database.
        collection_name: Collection to search (e.g. 'leases', 'manuals').
        query: Free-text search query.
        filter_field: Optional field name to filter on.
        filter_value: Optional value for the filter field.

    Returns:
        list[dict[str, Any]]: Matching documents with a 'score' field.
    """
    limit = DOCS_SEARCH_LIMIT

    # Strategy 1: Atlas Vector Search ($vectorSearch)
    query_vector = _get_embedding(query)
    if query_vector:
        try:
            vector_index_name = f"{collection_name}_vector_index"
            search_stage = {
                "$vectorSearch": {
                    "index": vector_index_name,
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 20,
                    "limit": limit,
                }
            }
            if filter_field and filter_value:
                search_stage["$vectorSearch"]["filter"] = {filter_field: filter_value}

            pipeline = [
                search_stage,
                {
                    "$project": {
                        "_id": 1,
                        "leaseId": 1,
                        "equipmentModel": 1,
                        "title": 1,
                        "content": 1,
                        "pdfUrl": 1,
                        "score": {"$meta": "vectorSearchScore"},
                    }
                }
            ]
            results = list(db[collection_name].aggregate(pipeline))
            if results:
                print(f"[Search API] Vector search succeeded for '{query}' on '{collection_name}'")
                return results
        except Exception as e:
            print(f"[Search API] Vector search failed or index not ready, trying Atlas Search: {e}")

    # Strategy 2: Atlas Text Search ($search) with phrase boost
    try:
        atlas_index_name = f"{collection_name}_search"
        should_clauses = [
            {
                "text": {
                    "query": query,
                    "path": ["content", "title"],
                    "fuzzy": {},
                }
            },
            {
                "phrase": {
                    "query": query,
                    "path": ["content", "title"],
                    "slop": 2,
                }
            }
        ]
        compound = {"should": should_clauses, "minimumShouldMatch": 1}
        if filter_field and filter_value:
            compound["filter"] = [
                {"text": {"query": filter_value, "path": filter_field}}
            ]

        pipeline = [
            {
                "$search": {
                    "index": atlas_index_name,
                    "compound": compound,
                }
            },
            {"$limit": limit},
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
            }
        ]
        results = list(db[collection_name].aggregate(pipeline))
        if results:
            print(f"[Search API] Atlas text search succeeded for '{query}' on '{collection_name}'")
            return results
    except Exception as e:
        print(f"[Search API] Atlas text search failed or index not ready, trying standard MongoDB text search: {e}")

    # Strategy 3: Standard MongoDB Text Search ($text)
    try:
        filter_dict = {}
        if filter_field and filter_value:
            filter_dict[filter_field] = filter_value
        filter_dict["$text"] = {"$search": query}

        cursor = db[collection_name].find(
            filter_dict,
            {
                "_id": 1,
                "leaseId": 1,
                "equipmentModel": 1,
                "title": 1,
                "content": 1,
                "pdfUrl": 1,
                "score": {"$meta": "textScore"}
            }
        ).sort([("score", {"$meta": "textScore"})]).limit(limit)

        results = list(cursor)
        if results:
            print(f"[Search API] Standard MongoDB text search succeeded for '{query}' on '{collection_name}'")
            return results
    except Exception as e:
        print(f"[Search API] Standard text search failed, trying regex fallback: {e}")

    # Strategy 4: Regex Fallback (match words case-insensitively)
    try:
        words = [w.strip() for w in query.split() if w.strip()]
        if not words:
            return []

        regex_patterns = [f"(?=.*{word})" for word in words]
        regex_query = "".join(regex_patterns)

        filter_dict = {}
        if filter_field and filter_value:
            filter_dict[filter_field] = filter_value

        filter_dict["$or"] = [
            {"title": {"$regex": regex_query, "$options": "i"}},
            {"content": {"$regex": regex_query, "$options": "i"}}
        ]

        cursor = db[collection_name].find(
            filter_dict,
            {
                "_id": 1,
                "leaseId": 1,
                "equipmentModel": 1,
                "title": 1,
                "content": 1,
                "pdfUrl": 1
            }
        ).limit(limit)

        results = []
        for doc in cursor:
            doc["score"] = 0.5  # assign default score
            results.append(doc)

        print(f"[Search API] Regex fallback search succeeded for '{query}' on '{collection_name}'")
        return results
    except Exception as e:
        print(f"[Search API] All search strategies failed: {e}")
        return []


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
            rows = _run_rag_search(
                db,
                collection_name="leases",
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
                        "score": row.get("score") or 0.5,
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
            rows = _run_rag_search(
                db,
                collection_name="manuals",
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
                        "score": row.get("score") or 0.5,
                    }
                )
        except Exception as e:
            print(f"[Search API] Manuals query failed: {e}")

    hits.sort(key=lambda x: x.get("score") or 0, reverse=True)
    return hits
