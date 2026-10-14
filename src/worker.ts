import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";

// Stateless streamable-HTTP MCP endpoint at /mcp for Cloudflare Workers.
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET")
      return new Response("carl-card-check-mcp: POST /mcp (MCP streamable HTTP). Informational only, not an authentication or appraisal.\n");
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    const server = createServer();
    await server.connect(transport);
    return transport.handleRequest(request);
  },
};
