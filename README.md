# axios-plugin-jwt

A plugin to simplify JWT authentication flow with Axios, supporting automatic token refresh and flexible token storage.

## Description

`axios-plugin-jwt` helps manage JWT tokens in applications using Axios. This plugin streamlines the process of injecting tokens into headers, handling automatic token refresh, and provides flexible storage options (such as SecureStore, localStorage, etc).

## Motivation

Many modern applications require JWT-based authentication. However, implementing token refresh, secure token storage, and handling expired tokens can be complex and error-prone. This plugin was created to reduce boilerplate and make JWT integration easier across different platforms (web, mobile, etc).

## Installation

```bash
bun add axios-plugin-jwt
```

## Usage Examples

### 1. Usage in Expo (React Native)

```js
import axios from "axios";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { withToken } from "./withToken";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

export default withToken(api, {
  getTokenFn: async () => {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },

  getRefreshTokenFn: async () => {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  setTokenFn: async (token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  setRefreshTokenFn: async (refreshToken) => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },

  removeTokenFn: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },

  refreshTokenEndpoint: "/auth/refresh-token",

  onRefreshFailure: () => {
    router.replace("/login");
  },
});
```

### 2. Usage in Web (localStorage)

```js
import axios from "axios";
import { withToken } from "./withToken";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

export default withToken(api, {
  getTokenFn: () => localStorage.getItem(TOKEN_KEY),
  getRefreshTokenFn: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokenFn: (token) => localStorage.setItem(TOKEN_KEY, token),
  setRefreshTokenFn: (refreshToken) =>
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
  removeTokenFn: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  refreshTokenEndpoint: "/auth/refresh-token",
  onRefreshFailure: () => {
    window.location.href = "/login";
  },
});
```

---

This project was created using `bun init` with bun v1.2.9. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
