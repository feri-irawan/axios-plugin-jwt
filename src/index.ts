import {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

type WithTokenOptions<T = any> = {
  // Function to get token
  getTokenFn: () => Promise<string | null>;

  // Function to get refresh token
  getRefreshTokenFn: () => Promise<string | null>;

  // Function to set token
  setTokenFn: (token: string) => Promise<void>;

  // Function to set refresh token
  setRefreshTokenFn: (refreshToken: string) => Promise<void>;

  // Function to remove token (when logout or refresh failed)
  removeTokenFn: () => Promise<void>;

  // URL endpoint for refresh token
  refreshTokenEndpoint: string;

  // Function called when refresh token fails (usually redirect to login)
  onRefreshFailure?: (error: any) => void | Promise<void>;

  // Authorization header prefix (default: 'Bearer ')
  authHeaderPrefix?: string;

  // Mapping response from refresh token endpoint
  refreshTokenResponseAdapter?: (response: T) => {
    token: string;
    refreshToken: string;
  };

  // Data payload to send to refresh token endpoint
  refreshTokenPayloadAdapter?: (refreshToken: string) => any;
};

// Type for failed request queue
type QueueItem = {
  resolve: (token: string) => void;
  reject: (err: any) => void;
};

/**
 * Adds authentication interceptor with refresh token to axios instance
 * @param axiosInstance Axios instance to add interceptor
 * @param options Configuration options for withToken
 * @returns Axios instance with added interceptor
 */
export const withToken = <T = any>(
  axiosInstance: AxiosInstance,
  options: WithTokenOptions<T>
): AxiosInstance => {
  const {
    getTokenFn,
    getRefreshTokenFn,
    setTokenFn,
    setRefreshTokenFn,
    removeTokenFn,
    refreshTokenEndpoint,
    onRefreshFailure,
    authHeaderPrefix = "Bearer ",
    refreshTokenResponseAdapter = (res: any) => ({
      token: res.token || res.accessToken,
      refreshToken: res.refreshToken,
    }),
    refreshTokenPayloadAdapter = (refreshToken: string) => ({ refreshToken }),
  } = options;

  // Variable to manage refresh token process
  let isRefreshing = false;
  let failedQueue: QueueItem[] = [];

  // Function to process failed request queue
  const processQueue = (error: any, token: string | null = null): void => {
    failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else if (token) {
        prom.resolve(token);
      }
    });
    failedQueue = [];
  };

  // Interceptor request: automatically add Authorization header if token is available
  axiosInstance.interceptors.request.use(
    async (config) => {
      const token = await getTokenFn();
      if (token && config.headers) {
        config.headers.Authorization = `${authHeaderPrefix}${token}`;
      }
      return config;
    },
    (error: any) => Promise.reject(error)
  );

  // Interceptor response: handle error 401 and refresh token if needed
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // If error 401 and not already tried to refresh, perform refresh token
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        // If refresh is in progress, add request to queue
        if (isRefreshing) {
          try {
            const token = await new Promise<string>((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            });
            originalRequest.headers.Authorization = `${authHeaderPrefix}${token}`;
            return axiosInstance(originalRequest);
          } catch (err) {
            return Promise.reject(err);
          }
        }

        isRefreshing = true;

        try {
          // Get refreshToken
          const refreshToken = await getRefreshTokenFn();
          if (!refreshToken) {
            throw new Error("No refresh token available");
          }

          // Request to refresh token endpoint
          const payload = refreshTokenPayloadAdapter(refreshToken);
          const response = await axiosInstance.post<T>(
            refreshTokenEndpoint,
            payload
          );

          // Extract token from response
          const { token: newToken, refreshToken: newRefreshToken } =
            refreshTokenResponseAdapter(response.data);

          // Save new token
          await setTokenFn(newToken);
          await setRefreshTokenFn(newRefreshToken);

          // Update default header and process queue
          axiosInstance.defaults.headers.common[
            "Authorization"
          ] = `${authHeaderPrefix}${newToken}`;
          processQueue(null, newToken);

          // Retry failed request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `${authHeaderPrefix}${newToken}`;
          }

          return axiosInstance(originalRequest);
        } catch (err) {
          // If refresh failed, process queue with error
          processQueue(err, null);

          // Remove token
          await removeTokenFn();

          // Call onRefreshFailure callback if provided
          if (onRefreshFailure) {
            await onRefreshFailure(err);
          }

          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }

      // If other error, reject
      return Promise.reject(error);
    }
  );

  return axiosInstance;
};
