export type Example = {
  id: string;
  label: string;
  rootName: string;
  target: "plain" | "serde-zig";
  samples: string[];
};

export const EXAMPLES: Example[] = [
  {
    id: "user-camel",
    label: "User (camelCase API)",
    rootName: "User",
    target: "serde-zig",
    samples: [
      `{
  "userId": 1,
  "firstName": "Alice",
  "email": "alice@example.com",
  "lastSeenAt": "2026-01-01T10:00:00Z"
}`,
      `{
  "userId": 2,
  "firstName": "Bob",
  "lastSeenAt": null
}`,
    ],
  },
  {
    id: "blog",
    label: "Nested + array of posts",
    rootName: "Blog",
    target: "serde-zig",
    samples: [
      `{
  "name": "My blog",
  "owner": { "id": 1, "displayName": "Alice" },
  "posts": [
    { "id": 1, "title": "Hello", "tags": ["intro", "meta"] },
    { "id": 2, "title": "Second", "tags": [] }
  ]
}`,
    ],
  },
  {
    id: "config-kebab",
    label: "Config (kebab-case)",
    rootName: "Cfg",
    target: "serde-zig",
    samples: [
      `{
  "server-port": 3000,
  "max-connections": 100,
  "log-level": "info",
  "feature-flags": {
    "experimental-router": true,
    "fast-path": false
  }
}`,
    ],
  },
  {
    id: "ids-map",
    label: "Dynamic-key map",
    rootName: "Roster",
    target: "serde-zig",
    samples: [
      `{
  "u-1001": { "name": "Alice", "active": true },
  "u-1002": { "name": "Bob", "active": false },
  "u-1003": { "name": "Carol", "active": true },
  "u-1004": { "name": "Dave", "active": true }
}`,
    ],
  },
  {
    id: "github-user",
    label: "GitHub-like user payload",
    rootName: "User",
    target: "serde-zig",
    samples: [
      `{
  "login": "octocat",
  "id": 1,
  "avatarUrl": "https://example.com/u/1.png",
  "type": "User",
  "siteAdmin": false,
  "name": "Octo Cat",
  "company": "GitHub",
  "blog": null,
  "publicRepos": 8
}`,
      `{
  "login": "ada",
  "id": 2,
  "avatarUrl": "https://example.com/u/2.png",
  "type": "User",
  "siteAdmin": false,
  "publicRepos": 0
}`,
    ],
  },
  {
    id: "stripe-invoice",
    label: "Stripe-like invoice",
    rootName: "Invoice",
    target: "serde-zig",
    samples: [
      `{
  "id": "in_1Abcd",
  "object": "invoice",
  "amountDue": 1999,
  "amountPaid": 0,
  "currency": "usd",
  "status": "open",
  "lines": [
    { "id": "il_1", "amount": 1999, "description": "Pro plan" }
  ],
  "metadata": {}
}`,
    ],
  },
  {
    id: "k8s-deployment",
    label: "Kubernetes deployment",
    rootName: "Deployment",
    target: "plain",
    samples: [
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
    tier: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: ghcr.io/me/api:latest
          ports:
            - containerPort: 8080
`,
    ],
  },
  {
    id: "cargo-toml",
    label: "Cargo-like manifest",
    rootName: "Manifest",
    target: "plain",
    samples: [
      `[package]
name = "myapp"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1"
tokio = "1"

[features]
default = ["json"]
json = []
`,
    ],
  },
  {
    id: "rss-feed",
    label: "RSS feed",
    rootName: "Rss",
    target: "serde-zig",
    samples: [
      `<rss version="2.0">
  <channel>
    <title>Example feed</title>
    <link>https://example.com</link>
    <description>An example RSS channel</description>
    <item>
      <title>First post</title>
      <link>https://example.com/1</link>
      <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,
    ],
  },
];
