"""API routes for documents and manuals search endpoints."""

from typing import Any, Optional
from elasticsearch import Elasticsearch
from fastapi import APIRouter, Depends

from operio_agent.api.deps import get_elastic_client

router = APIRouter()


@router.get("/docs/search")
def search_docs(
    query: str,
    type: Optional[str] = None,
    leaseId: Optional[str] = None,
    equipmentModel: Optional[str] = None,
    elastic_client: Elasticsearch = Depends(get_elastic_client),
) -> list[dict[str, Any]]:
    """Exposes raw Elasticsearch query matches directly to the Knowledge Inspector.

    Args:
        query: The search text query.
        type: Document type filter ('leases', 'manuals', 'all').
        leaseId: Optional lease ID to filter search results.
        equipmentModel: Optional equipment model to filter search results.
        elastic_client: Injected Elasticsearch client.

    Returns:
        list[dict[str, Any]]: Combined list of relevance-sorted document hits.
    """
    if type and type.lower() == "all":
        type = None

    hits = []

    # 1. Search leases index
    if not type or type == "leases":
        filter_clauses = []
        if leaseId and leaseId.lower() != "all":
            filter_clauses.append({"term": {"leaseId.keyword": leaseId}})

        body: dict[str, Any] = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["content", "title"],
                                "fuzziness": "AUTO",
                            }
                        }
                    ]
                }
            },
            "size": 4,
        }
        if filter_clauses:
            body["query"]["bool"]["filter"] = filter_clauses

        try:
            response = elastic_client.search(index="leases", body=body)
            for hit in response["hits"]["hits"]:
                hits.append(
                    {
                        "id": hit["_id"],
                        "type": "leases",
                        "title": hit["_source"].get("title"),
                        "content": hit["_source"].get("content"),
                        "pdfUrl": hit["_source"].get("pdfUrl"),
                        "leaseId": hit["_source"].get("leaseId"),
                        "score": hit["_score"],
                    }
                )
        except Exception as e:
            print(f"[Search API] Leases query failed: {e}")

    # 2. Search manuals index
    if not type or type == "manuals":
        filter_clauses = []
        if equipmentModel and equipmentModel.lower() != "all":
            filter_clauses.append(
                {"term": {"equipmentModel.keyword": equipmentModel}}
            )

        body = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["content", "title"],
                                "fuzziness": "AUTO",
                            }
                        }
                    ]
                }
            },
            "size": 4,
        }
        if filter_clauses:
            body["query"]["bool"]["filter"] = filter_clauses

        try:
            response = elastic_client.search(index="manuals", body=body)
            for hit in response["hits"]["hits"]:
                hits.append(
                    {
                        "id": hit["_id"],
                        "type": "manuals",
                        "title": hit["_source"].get("title"),
                        "content": hit["_source"].get("content"),
                        "pdfUrl": hit["_source"].get("pdfUrl"),
                        "equipmentModel": hit["_source"].get("equipmentModel"),
                        "score": hit["_score"],
                    }
                )
        except Exception as e:
            print(f"[Search API] Manuals query failed: {e}")

    # Sort combined hits by relevance score descending
    hits.sort(key=lambda x: x["score"], reverse=True)
    return hits
