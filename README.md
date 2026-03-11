# AMSHS Data API

A lightweight MongoDB REST API middleware for the Angelito M. Sarmiento High School Portal.

## Environment Variables (set in Render)

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `API_KEY` | Secret key — must match the portal config |
| `DB_NAME` | Database name (e.g. `amshs_portal`) |
| `PORT` | Port to listen on (Render sets this automatically) |

## Endpoints

All endpoints require the `x-api-key` header.

- `POST /action/find`
- `POST /action/findOne`
- `POST /action/insertOne`
- `POST /action/updateOne`
- `POST /action/deleteOne`
- `POST /action/aggregate`
- `GET /` — health check
