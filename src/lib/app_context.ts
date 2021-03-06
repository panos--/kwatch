import { KubeConfig, V1Namespace } from "@kubernetes/client-node";
import { K8sClient } from "./client";
import { APIResource } from "./api_resource";
import { Widgets } from "blessed";
import { WidgetFactory } from "./widget_factory";
import { ColorScheme } from "./color_scheme";

export interface State {
    namespace: V1Namespace;
    namespaces: V1Namespace[];
    apiResource: APIResource;
    apiResources: APIResource[];
    refreshInterval: number;
}

export class AppState implements State {
    public namespace: V1Namespace = null;
    public namespaces: V1Namespace[] = [];
    public apiResource: APIResource = null;
    public apiResources: APIResource[] = [];
    public refreshInterval: number = -1;

    public static unserialize(state: State) {
        if (state.namespace !== null) {
            let namespace = new V1Namespace();
            Object.assign(namespace, state.namespace);
            state.namespace = namespace;
        }

        if (state.apiResource !== null) {
            let apiResource = new APIResource(
                state.apiResource.resource,
                state.apiResource.groupVersion,
                state.apiResource.group
            );
            state.apiResource = apiResource;
        }
    }
}

export interface AppModelContext {
    kubeConfig: KubeConfig;
    client: K8sClient;
    state: State;
    pager: string;
}

export interface AppViewContext {
    screen: Widgets.Screen;
    colorScheme: ColorScheme;
    widgetFactory: WidgetFactory;
}

export class AppContext implements AppModelContext, AppViewContext {
    // model context
    public kubeConfig: KubeConfig;
    public client: K8sClient;
    public state: State;
    public pager: string;

    // view context
    public screen: Widgets.Screen;
    public colorScheme: ColorScheme;
    public widgetFactory: WidgetFactory;
}
