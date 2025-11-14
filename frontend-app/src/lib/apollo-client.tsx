'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

// HTTP link
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3000/graphql',
});

// Auth link untuk menambahkan token
const authLink = setContext((_, { headers }) => {
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('jwt-token');
  }
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

// WebSocket link untuk Subscriptions
const wsLink = typeof window !== "undefined" 
  ? new GraphQLWsLink(createClient({
      url: process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || 'ws://localhost:3000/graphql', // Arahkan ke Gateway
      connectionParams: () => {
        // Kirim token saat koneksi WebSocket
        const token = localStorage.getItem('jwt-token');
        return {
          Authorization: token ? `Bearer ${token}` : '',
        };
      },
    }))
  : null;

// Split link antara HTTP dan WebSocket
const splitLink = typeof window !== "undefined" && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      authLink.concat(httpLink),
    )
  : authLink.concat(httpLink);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}