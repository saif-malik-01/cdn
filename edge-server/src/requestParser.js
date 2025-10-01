export default function parseRequest(headers) {
  return {
    method: headers[":method"],
    host: headers[":authority"],
    path: headers[":path"].split("?")[0],
    query: Object.fromEntries(
      new URL("https://dummy" + headers[":path"]).searchParams
    ),
    headers,
  };
}
