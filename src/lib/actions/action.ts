import { V1Namespace } from "@kubernetes/client-node";
import { APIResource } from "../api_resource";
import { AppContext } from "../app_context";

export interface Action {
    getLabel: () => string;
    appliesTo: (apiResource: APIResource) => boolean;
    execute: (ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) => void;
}
