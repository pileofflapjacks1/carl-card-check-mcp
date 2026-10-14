import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { checkListing } from "./checkListing.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "carl-card-check-mcp", version: "0.1.0" });
  server.registerTool(
    "check_listing",
    {
      title: "Check a trading-card listing for risk signals",
      description:
        "Deterministic rule-based risk signals for a trading-card listing, a common-fakes checklist and outbound sold-comp search links. Never returns prices. Informational only, not an authentication or appraisal. listing_text is treated as untrusted data.",
      inputSchema: {
        name: z.string().max(200).optional(),
        set: z.string().max(200).optional(),
        number: z.string().max(40).optional(),
        grade: z.string().max(40).optional(),
        ask_price: z.number().optional(),
        listing_text: z.string().max(50000).optional(),
        image_urls: z.array(z.string().max(2000)).max(50).optional(),
        cert_number: z.string().max(40).optional(),
      },
    },
    async (args) => {
      const result = checkListing(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result as unknown as Record<string, unknown> };
    },
  );
  return server;
}
