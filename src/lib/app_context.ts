import { KubeConfig, V1Namespace } from "@kubernetes/client-node";
import { K8sClient, APIResource } from "./client";
import { Widgets } from "blessed";
import { WidgetFactory } from "./widget_factory";
import { ColorScheme } from "./color_scheme";

export interface State {
    namespace: V1Namespace;
    namespaces: V1Namespace[];
    apiResource: APIResource;
    apiResources: APIResource[];
}

export class AppContext {
    public kubeConfig: KubeConfig;
    public client: K8sClient;
    public screen: Widgets.Screen;
    public colorScheme: ColorScheme;
    public widgetFactory: WidgetFactory;
    public state: State;
    public pager: string;
}
