import type { FastifyPluginAsync } from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer, type McpDeps } from "../mcp/server.js";

export const mcpRoutes: FastifyPluginAsync<McpDeps> = async (app, deps) => {
  app.post("/mcp", { schema: { hide: true } }, async (req, reply) => {
    const server = createMcpServer(deps);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    reply.hijack();
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (err) {
      req.log.error({ err }, "MCP request failed");
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "content-type": "application/json" });
      }
      reply.raw.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error." },
          id: null,
        }),
      );
    }
  });

  app.route({
    method: ["GET", "DELETE"],
    url: "/mcp",
    schema: { hide: true },
    handler: async (_req, reply) => {
      reply.code(405).header("Allow", "POST");
      return {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      };
    },
  });
};
