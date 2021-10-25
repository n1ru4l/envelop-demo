import fastify from "fastify";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from "graphql-helix";
import { sendResult } from "graphql-helix";
import {
  envelop,
  useSchema,
  useMaskedErrors,
  useExtendContext,
} from "@envelop/core";
import { useLiveQuery } from "@envelop/live-query";
import { InMemoryLiveQueryStore } from "@n1ru4l/in-memory-live-query-store";
import {
  useExtendedValidation,
  OneOfInputObjectsRule,
} from "@envelop/extended-validation";
import { useSentry } from "@envelop/sentry";
import * as Sentry from "@sentry/node";
import { useAuth0 } from "@envelop/auth0";
import { schema } from "./schema";

const liveQueryStore = new InMemoryLiveQueryStore();

Sentry.init({
  dsn: "https://27a658299fd94e9a92e09263341156bb@o981418.ingest.sentry.io/5935947",
  tracesSampleRate: 1.0,
});

const app = fastify();

const auth0Config = {
  domain: "dream-watch.eu.auth0.com",
  clientId: "bOHmIJvdJJ7Stj3m1zAFwfBmmBB8Z0MD",
  audience: "http://localhost:3000/graphql",
};

const greetings = ["hi", "sup", "hallo"];

setInterval(() => {
  const greeting = greetings.shift()!;
  greetings.push(greeting);
  liveQueryStore.invalidate("Query.greetings");
}, 1000).unref();

const getEnveloped = envelop({
  plugins: [
    useSchema(schema),
    useExtendedValidation({
      rules: [OneOfInputObjectsRule],
    }),
    useLiveQuery({
      liveQueryStore,
    }),
    useExtendContext(() => ({
      greetings,
    })),
    useAuth0({
      domain: auth0Config.domain,
      audience: auth0Config.audience,
      preventUnauthenticatedAccess: false,
      extendContextField: "auth0",
      tokenType: "Bearer",
    }),
    // useLogger(),
    useMaskedErrors(),
    useSentry(),
  ],
});

app.route({
  method: "GET",
  url: "/",
  async handler(req, res) {
    res.header("Content-Type", "text/html; charset=UTF-8");
    res.send(/* HTML */ `
      <!DOCTYPE html />
      <html>
        <head>
          <script src="https://cdn.auth0.com/js/auth0-spa-js/1.12/auth0-spa-js.production.js"></script>
        </head>
        <body>
          <script>
            createAuth0Client({
              domain: "${auth0Config.domain}",
              client_id: "${auth0Config.clientId}",
              audience: "${auth0Config.audience}",
            }).then(async (auth0) => {
              const isAuthenticated = await auth0.isAuthenticated();
              await auth0.loginWithPopup();
              const accessToken = await auth0.getTokenSilently();
              window.document.body.innerText = accessToken;
            });
          </script>
        </body>
      </html>
    `);
  },
});

app.route({
  method: ["GET", "POST"],
  url: "/graphql",
  async handler(req, res) {
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };

    if (shouldRenderGraphiQL(request)) {
      res.type("text/html");
      res.send(renderGraphiQL());
    } else {
      const { execute, contextFactory, parse, validate, schema } = getEnveloped(
        {
          req,
        }
      );
      const { operationName, query, variables } = getGraphQLParameters(request);
      const result = await processRequest({
        operationName,
        query,
        variables,
        schema,
        request,
        execute,
        contextFactory,
        parse,
        validate,
      });

      await sendResult(result, res.raw);
      res.sent = true
    }
  },
});

app.listen(3000, "localhost", () => {
  console.log("Listening on http://localhost:3000/graphql");
});
