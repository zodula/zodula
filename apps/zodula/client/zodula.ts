import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import * as zodulaUtils from './utils';
import { ZodulaDoc } from './doc';
import { ZodulaClientRealtime } from './realtime';
import { toast } from '../ui';

interface ZodulaOptions {
    onRequest?: (config: AxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;
    onResponse?: (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>;
}

export class Zodula {
    public api: AxiosInstance;
    private baseUrl: string;

    constructor(baseUrl: string, options: ZodulaOptions = {}) {
        this.baseUrl = baseUrl;
        this.api = axios.create({
            baseURL: baseUrl,
            withCredentials: true
        });

        // Add request interceptor
        if (options.onRequest) {
            this.api.interceptors.request.use(options.onRequest);
        }

        // Add response interceptor
        this.api.interceptors.response.use(
            (response) => {
                if (options.onResponse) {
                    return options.onResponse(response);
                }
                return response;
            },
            (error) => {
                // Handle error response
                if (options.onResponse) {
                    return options.onResponse(error);
                }
                throw error;
            }
        );
    }

    setBaseUrl(url: string) {
        this.api.defaults.baseURL = url;
    }

    async get_action<AP extends Zodula.ActionPath = Zodula.ActionPath>(action: AP, options?: {
        params?: Record<string, string>
    }): Promise<Zodula.ActionResponse[AP]> {
        return (await this.api.get(`/api/action/${action}`, options))?.data
    }

    async action<AP extends Zodula.ActionPath = Zodula.ActionPath>(action: AP, options?: {
        data?: Zodula.ActionRequest[AP]
        params?: Record<string, string>
    }): Promise<Zodula.ActionResponse[AP]> {
        return (await this.api.post(`/api/action/${action}`, options?.data, {
            params: options?.params
        }))?.data
    }

    get doc() {
        return new ZodulaDoc(this.api)
    }

    get utils() {
        return zodulaUtils
    }

    get realtime() {
        return new ZodulaClientRealtime(this.baseUrl)
    }

    get theme() {
        return {
            isDark: () => {
                return document.documentElement.classList.contains("dark")
            },
            setTheme: (theme: "dark" | "light") => {
                document.documentElement.classList.toggle("dark", theme === "dark")
                localStorage.setItem("zodula-theme", theme)
            },
            toggleTheme: () => {
                const isDark = document.documentElement.classList.contains("dark")
                const newTheme = isDark ? "light" : "dark"
                document.documentElement.classList.toggle("dark")
                localStorage.setItem("zodula-theme", newTheme)
            },
            loadTheme: () => {
                const savedTheme = localStorage.getItem("zodula-theme") as "dark" | "light" | null
                if (savedTheme) {
                    document.documentElement.classList.toggle("dark", savedTheme === "dark")
                }
            }
        }
    }

}

export function createZodulaClient(baseUrl: string, options: ZodulaOptions = {}) {
    return new Zodula(baseUrl, options);
}

export const zodula = createZodulaClient(zodulaUtils.BASE_URL, {
    onResponse(response: any) {
        if (response.status === 200) {
            return response
        }

        let errorMessage: string = "An error occurred"
        if (typeof response.response?.data?.message === "string") {
            errorMessage = response.response.data.message
        } else if (typeof response.response.data.message === "object") {
            errorMessage = JSON.stringify(response.response.data.message)
        } else if (typeof response.response?.data === "string") {
            errorMessage = response.response.data
        } else if (typeof response.response?.data?.error === "string") {
            errorMessage = response.response.data.error
        } else if (typeof response.response?.data?.error === "object") {
            errorMessage = JSON.stringify(response.response.data.error)
        }

        const isLoginPage = location.pathname.startsWith("/login")
        if (response.status === 401) {
            !isLoginPage && toast.error(`Unauthorized`, errorMessage, {
                id: "unauthorized",
            });
            throw new Error(errorMessage)
        }

        if (response.status === 403) {
            !isLoginPage && toast.error(`Forbidden`, errorMessage, {
                id: "forbidden",
            });
            throw new Error(errorMessage)
        }

        toast.error(`Error`, errorMessage, {
            id: errorMessage
        });
        throw new Error(errorMessage)
    },
});