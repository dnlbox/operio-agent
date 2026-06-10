export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const cleanText = text.replace(/\s+/g, ' ').trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: cleanText }] }
      })
    });

    if (!response.ok) return null;
    const result = await response.json() as any;
    return result.embedding?.values || null;
  } catch (err) {
    console.error('[MongoDB MCP] Failed to get embedding:', err);
    return null;
  }
}

export async function runRagSearch(
  database: any,
  collectionName: string,
  query: string,
  filterField: string,
  filterValue: string
): Promise<any[]> {
  const limit = 3;

  // 1. Vector Search
  const queryVector = await getEmbedding(query);
  if (queryVector) {
    try {
      const vectorPipeline = [
        {
          $vectorSearch: {
            index: `${collectionName}_vector_index`,
            path: 'embedding',
            queryVector,
            numCandidates: 20,
            limit,
            filter: { [filterField]: filterValue }
          }
        },
        {
          $project: {
            _id: 1,
            [filterField]: 1,
            title: 1,
            content: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ];
      const results = await database.collection(collectionName).aggregate(vectorPipeline).toArray();
      if (results && results.length > 0) {
        console.error(`[MongoDB MCP] Vector search succeeded for "${query}" on ${collectionName}`);
        return results.map((doc: any) => ({
          id: doc._id.toString(),
          [filterField]: doc[filterField],
          title: doc.title,
          content: doc.content,
          score: doc.score
        }));
      }
    } catch (err) {
      console.error(`[MongoDB MCP] Vector search failed/not-ready, trying Atlas Search:`, err);
    }
  }

  // 2. Atlas Search with Phrase Boost
  try {
    const pipeline = [
      {
        $search: {
          index: `${collectionName}_search`,
          compound: {
            should: [
              {
                text: {
                  query,
                  path: ['content', 'title'],
                  fuzzy: {}
                }
              },
              {
                phrase: {
                  query,
                  path: ['content', 'title'],
                  slop: 2
                }
              }
            ],
            minimumShouldMatch: 1,
            filter: [
              {
                text: {
                  query: filterValue,
                  path: filterField
                }
              }
            ]
          }
        }
      },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          [filterField]: 1,
          title: 1,
          content: 1,
          score: { $meta: 'searchScore' }
        }
      }
    ];
    const results = await database.collection(collectionName).aggregate(pipeline).toArray();
    if (results && results.length > 0) {
      console.error(`[MongoDB MCP] Atlas search succeeded for "${query}" on ${collectionName}`);
      return results.map((doc: any) => ({
        id: doc._id.toString(),
        [filterField]: doc[filterField],
        title: doc.title,
        content: doc.content,
        score: doc.score
      }));
    }
  } catch (err) {
    console.error(`[MongoDB MCP] Atlas search failed/not-ready, trying standard text search:`, err);
  }

  // 3. Standard Text Search ($text)
  try {
    const results = await database.collection(collectionName).find(
      {
        [filterField]: filterValue,
        $text: { $search: query }
      },
      {
        projection: {
          _id: 1,
          [filterField]: 1,
          title: 1,
          content: 1,
          score: { $meta: 'textScore' }
        },
        sort: { score: { $meta: 'textScore' } },
        limit
      }
    ).toArray();

    if (results && results.length > 0) {
      console.error(`[MongoDB MCP] Standard text search succeeded for "${query}" on ${collectionName}`);
      return results.map((doc: any) => ({
        id: doc._id.toString(),
        [filterField]: doc[filterField],
        title: doc.title,
        content: doc.content,
        score: doc.score || 0.5
      }));
    }
  } catch (err) {
    console.error(`[MongoDB MCP] Standard text search failed, trying regex fallback:`, err);
  }

  // 4. Regex Fallback
  try {
    const words = query.split(/\s+/).filter((w: string) => w.trim().length > 0);
    if (words.length > 0) {
      const regexQuery = words.map((w: string) => `(?=.*${w})`).join('');
      const filter = {
        [filterField]: filterValue,
        $or: [
          { title: { $regex: regexQuery, $options: 'i' } },
          { content: { $regex: regexQuery, $options: 'i' } }
        ]
      };
      const results = await database.collection(collectionName).find(filter).limit(limit).toArray();
      console.error(`[MongoDB MCP] Regex fallback search succeeded for "${query}" on ${collectionName}`);
      return results.map((doc: any) => ({
        id: doc._id.toString(),
        [filterField]: doc[filterField],
        title: doc.title,
        content: doc.content,
        score: 0.5
      }));
    }
  } catch (err) {
    console.error(`[MongoDB MCP] All search fallbacks failed:`, err);
  }

  return [];
}
