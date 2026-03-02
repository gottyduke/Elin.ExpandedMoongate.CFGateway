## Expanded Moongate CFGateway

The API gateway that exposes the server to the public.

## API Specification

> This can change anytime.

```yaml
openapi: 3.0.0
info:
  title: Expanded Moongate API
  version: 1.0.0
  description: WIP OpenAPI documentation for the Cloudflare Worker API.

servers:
  - url: https://api-exmoongate.elin-modding.net

tags:
  - name: maps
  - name: files
  - name: ratings

components:
  parameters:
    RequestIdHeader:
      name: x-request-id
      in: header
      required: true
      schema:
        type: string
      description: Required client/user identifier (served as Steam ID in code).
    DebugKeyHeader:
      name: x-debugging-key
      in: header
      required: false
      schema:
        type: string
      description: Optional debug bypass key checked in KV.
  schemas:
    MapMetaBody:
      type: object
      required: [author, version, title, created_at]
      properties:
        author: { type: string }
        title: { type: string }
        language: { type: string, nullable: true }
        category: { type: string, nullable: true }
        created_at: { type: string, description: Date string used in file naming }
        version: { type: integer }
        tag: { type: string, nullable: true }

    RatingBody:
      type: object
      required: [map_id, author, score]
      properties:
        map_id: { type: string }
        author: { type: integer }
        score: { type: integer, minimum: 1, maximum: 5 }
        comment: { type: string, nullable: true }

    MapRecord:
      type: object
      properties:
        file_key: { type: string }
        id: { type: string }
        author: { type: string }
        title: { type: string }
        language: { type: string, nullable: true }
        category: { type: string, nullable: true }
        created_at: { type: string }
        version: { type: integer }
        tag: { type: string, nullable: true }
        visit_count: { type: integer }
        rating_count: { type: integer }
        rating_average: { type: number }
        file_size: { type: integer }
        preview_key: { type: string, nullable: true }

    RatingRecord:
      type: object
      properties:
        uuid: { type: string }
        map_id: { type: string }
        author: { type: integer }
        score: { type: integer }
        comment: { type: string, nullable: true }
        rated_at: { type: string }

paths:
  /maps/upload/{mapId}:
    post:
      tags: [maps]
      summary: Upload map metadata / request file upload key
      parameters:
        - $ref: '#/components/parameters/RequestIdHeader'
        - $ref: '#/components/parameters/DebugKeyHeader'
        - name: mapId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MapMetaBody'
      responses:
        '201':
          description: Metadata inserted successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok: { type: boolean }
                  mapId: { type: string }
        '424':
          description: File missing; upload required file first with the provisioned fileKeyId
          content:
            application/json:
              schema:
                type: object
                properties:
                  fileKeyId: { type: string }
        '409':
          description: Conflict (same file/meta exists)

  /files/upload/{fileKeyId}:
    post:
      tags: [files]
      summary: Upload binary file to pending file key
      parameters:
        - $ref: '#/components/parameters/RequestIdHeader'
        - $ref: '#/components/parameters/DebugKeyHeader'
        - name: fileKeyId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/octet-stream:
            schema:
              type: string
              format: binary
      responses:
        '201':
          description: File uploaded
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok: { type: boolean }
                  fileKey: { type: string }
                  size: { type: integer }
        '403': { description: Upload key invalid/expired }
        '409': { description: File already exists }
        '413': { description: File too large }

  /maps/download/{mapId}:
    get:
      tags: [maps]
      summary: Download map file
      parameters:
        - $ref: '#/components/parameters/RequestIdHeader'
        - $ref: '#/components/parameters/DebugKeyHeader'
        - name: mapId
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: Binary map file
          content:
            application/octet-stream:
              schema:
                type: string
                format: binary
        '404': { description: Map or file not found }

  /maps/query/{mapId}:
    get:
      tags: [maps]
      summary: Query latest map metadata by map ID
      parameters:
        - $ref: '#/components/parameters/RequestIdHeader'
        - $ref: '#/components/parameters/DebugKeyHeader'
        - name: mapId
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: Map found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MapRecord'
        '404':
          description: Not found
          content:
            application/json:
              schema:
                type: object
                properties:
                  found: { type: boolean, example: false }

  /maps/top/{sort}/{limit}/{page}:
    get:
      tags: [maps]
      summary: Get top maps
      parameters:
        - $ref: '#/components/parameters/RequestIdHeader'
        - $ref: '#/components/parameters/DebugKeyHeader'
        - name: sort
          in: path
          required: true
          schema:
            type: string
            enum: [created, rating, visits]
        - name: limit
          in: path
          required: true
          schema:
            type: integer
            maximum: 200
        - name: page
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: List of maps
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/MapRecord'

  /ratings/{mapId}:
    post:
      tags: [ratings]
      summary: Create or update rating for a map by author
      parameters:
        - $ref: '#/components/parameters/RequestIdHeader'
        - $ref: '#/components/parameters/DebugKeyHeader'
        - name: mapId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RatingBody'
      responses:
        '200':
          description: Rating upserted
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok: { type: boolean }
        '404': { description: Map not found }

  /ratings/{mapId}/{limit}:
    get:
      tags: [ratings]
      summary: Get latest ratings for a map
      parameters:
        - $ref: '#/components/parameters/RequestIdHeader'
        - $ref: '#/components/parameters/DebugKeyHeader'
        - name: mapId
          in: path
          required: true
          schema: { type: string }
        - name: limit
          in: path
          required: true
          schema:
            type: integer
            maximum: 100
      responses:
        '200':
          description: List of ratings
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/RatingRecord'
        '404': { description: Map not found }
```