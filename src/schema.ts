import { makeExecutableSchema } from "@graphql-tools/schema";
import { EnvelopError } from "@envelop/core";
import { ONE_OF_DIRECTIVE_SDL } from "@envelop/extended-validation";

export const schema = makeExecutableSchema({
  typeDefs: [
    ONE_OF_DIRECTIVE_SDL,
    /* GraphQL */ `
      directive @live on QUERY
    `,
    /* GraphQL */ `
      type AuthenticationInfo {
        sub: String!
      }

      type Query {
        ping: Boolean
        secret: Boolean
        authInfo: AuthenticationInfo
        slowString: String
        greetings: [String!]!
      }

      input LogInput @oneOf {
        debug: String
        warning: String
        error: String
        info: String
      }

      type Mutation {
        log(input: LogInput): Boolean
      }
    `,
  ],

  resolvers: {
    Query: {
      ping: () => true,
      secret: () => {
        throw new Error("Database goes brrt.");
      },
      authInfo: (_, __, context) => {
        return context.auth0;
      },
      slowString: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return "I am a bit late...";
      },
      greetings: (_, __, context) => context.greetings,
    },
  },
});
