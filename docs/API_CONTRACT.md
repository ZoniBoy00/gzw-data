# GZW Data API response contract

This document describes the stable JSON envelopes exposed by `/api/v1`. The
legacy `/api` prefix currently exposes the same contract, but new integrations
should use the versioned prefix.

## Common response metadata

Successful and error responses include:

- `source`: always `GZW Data API`
- `timestamp`: ISO 8601 timestamp for the response
- `dataVersion`: timestamp of the published scraper snapshot, or `null` when
  no dataset snapshot is available

Data responses also include a `data` property. The shape of `data` depends on
the route.

## Collection responses

Paginated dataset routes return an array in `data` and pagination metadata:

```json
{
  "data": [{ "id": "ak-12", "name": "AK-12" }],
  "count": 1,
  "page": 1,
  "perPage": 50,
  "total": 44,
  "totalPages": 1,
  "source": "GZW Data API",
  "timestamp": "2026-09-20T08:00:00.000Z",
  "dataVersion": "2026-09-14T13:05:54.486874Z"
}
```

- `count` is the number of records in the current response.
- `total` is the number of records after filters and before pagination.
- `totalPages` is calculated from `total` and `perPage`.
- `page` starts at `1`.
- `perPage` defaults to `50` and is capped at `500`.

When pagination is disabled with `all=true`, or when a route returns an
unpaginated collection, the pagination fields are omitted. `data` remains an
array and `count` remains its length.

## Single-record responses

A successful exact-ID request returns one object in `data`, not an array:

```http
GET /api/v1/weapons/ak-12
```

```json
{
  "data": {
    "id": "ak-12",
    "name": "AK-12"
  },
  "source": "GZW Data API",
  "timestamp": "2026-09-20T08:00:00.000Z",
  "dataVersion": "2026-09-14T13:05:54.486874Z"
}
```

Unknown IDs return `404` with `RECORD_NOT_FOUND`.

## Metadata and schema responses

`GET /api/v1/metadata` returns a dataset registry. Each dataset entry includes
its name, item count, observed fields, and capabilities. Use
`GET /api/v1/metadata/{dataset}` for one dataset, or add `?full=true` for
field types, optionality, nullability, and examples.

`GET /api/v1/schema/{dataset}` returns the machine-readable schema for one
dataset. The schema and OpenAPI document are generated from the same metadata
source as the metadata endpoints.

Example metadata entry:

```json
{
  "name": "weapons",
  "file": "weapons.json",
  "itemCount": 44,
  "fields": ["id", "image", "name"],
  "capabilities": {
    "operations": ["list", "get", "filter", "sort", "paginate"],
    "filters": { "supported": true, "fields": ["id", "image", "name"] },
    "sorting": {
      "supported": true,
      "fields": ["id", "image", "name"],
      "directions": ["asc", "desc"]
    },
    "counts": {
      "supported": true,
      "includesTotal": true,
      "includesPageCount": true
    }
  }
}
```

Clients should use capabilities metadata instead of guessing which fields a
dataset supports.

## Error responses

All HTTP errors use the same envelope and a stable `error.code`:

```json
{
  "error": {
    "code": "DATASET_NOT_FOUND",
    "message": "Dataset data not found",
    "dataset": "does-not-exist",
    "docs": "/api/v1/spec"
  },
  "source": "GZW Data API",
  "timestamp": "2026-09-20T08:00:00.000Z",
  "dataVersion": "2026-09-14T13:05:54.486874Z"
}
```

Common codes include:

- `DATASET_NOT_FOUND` — the requested dataset does not exist.
- `RECORD_NOT_FOUND` — the dataset exists, but the requested ID does not.
- `ENDPOINT_NOT_FOUND` — the route is not supported.
- `INVALID_REQUEST` — query parameters or request data are invalid.
- `METHOD_NOT_ALLOWED` — the route accepts `GET` only, apart from CORS `OPTIONS`.
- `RATE_LIMITED` — the active instance limit was exceeded.
- `INTERNAL_ERROR` — an unexpected server-side error occurred.

Rate-limited responses additionally include `error.retryAfter` in seconds and
the `Retry-After` HTTP header.

## Related and export responses

`GET /api/v1/items/{id}/context` returns an object in `data` containing
`item`, `vendors`, `references`, `referenceCount`, and a note explaining that
references are textual matches from the current datasets, not guaranteed
in-game relationships.

`GET /api/v1/export/{dataset}` returns an array in `data` plus an `export`
object containing `dataset`, `count`, and `maxRecords`. Exports are limited to
500 matching records and include `Content-Disposition` and
`X-Export-Record-Limit` headers.

## Version semantics

- `apiVersion` identifies the public route contract and is currently `v1`.
- `implementationVersion` identifies compatible implementation releases.
- `dataVersion` identifies the current published scraper snapshot.

A data refresh changes `dataVersion`, not `apiVersion`. Removing or changing
the meaning or type of a public field requires a new API line, migration notes,
and a compatibility window.
