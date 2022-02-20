const { createServer } = require("http");
const express = require("express");
const { execute, subscribe } = require("graphql");
const { ApolloServer, gql } = require("apollo-server-express");
const { SubscriptionServer } = require("subscriptions-transport-ws");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { KafkaPubSub } = require("graphql-kafka-subscriptions");

(async () => {
    
    const pubsub = new KafkaPubSub({
        topic: 'MessageService',
        host: '127.0.0.1',
        port: '9092',
        globalConfig: {} // options passed directly to the consumer and producer
    })
    const app = express();
    const httpServer = createServer(app);

    const typeDefs = gql`

    type Query {
      viewMessages: [Message!]
    }
    type Mutation {
      sendMessage(name: String, content: String): Message!
    }
    type Subscription {
      receiveMessage: Message!
    }
    type Message {
        id: ID!
        name: String!
        content: String
    }
  `;

  let messages = []
  const resolvers = {
    Query: {
      viewMessages() {
        return messages;
      },
    },
    Mutation: {
      sendMessage: (parent, { name, content }) => {
        const id = messages.length;
        var new_message = {
            id,
            name,
            content
        }
        messages.push(new_message);
        pubsub.publish("MessageService", {receiveMessage: new_message});
        return new_message;
      },
    },
    Subscription: {
      receiveMessage: {
        subscribe: () => pubsub.asyncIterator(["MessageService"]),
      },
    },
  };

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const server = new ApolloServer({
    schema,
  });
  await server.start();
  server.applyMiddleware({ app });

  SubscriptionServer.create(
    { schema, execute, subscribe },
    { server: httpServer, path: '/graphql' }
  );
  const PORT = 4000;
  httpServer.listen(PORT, () => {
    console.log(
      `🚀 Query endpoint ready at http://localhost:${PORT}${server.graphqlPath}`
    );
    console.log(
      `🚀 Subscription endpoint ready at ws://localhost:${PORT}${server.graphqlPath}`
    );
  });

})();
