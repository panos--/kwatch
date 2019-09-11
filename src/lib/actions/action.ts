import * as blessed from "blessed";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";

export interface Action {
    getLabel: () => string;
    appliesTo: (apiResource: APIResource) => boolean;
    execute: (client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) => void;
}
