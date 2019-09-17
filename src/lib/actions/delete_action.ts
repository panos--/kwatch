import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";
import { WidgetFactory } from "../widget_factory";
import { AppDefaults } from "../app_defaults";

export class DeleteAction implements Action {
    public getLabel() {
        return "Delete";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.verbs.includes("delete");
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        const question = WidgetFactory.question({ parent: screen, width: 80 });
        question.ask(
            `Delete ${apiResource.getSingularName()} ${resource} `
            + `in namespace ${namespace.metadata.name}?`,
            (err, yes) => {
                if (!yes) {
                    return;
                }
                let loading = blessed.loading({
                    top: "center",
                    left: "center",
                    height: 5,
                    width: 13,
                    mouse: true,
                    keys: true,
                    border: "line",
                });
                loading.style.border.bg = AppDefaults.COLOR_BORDER_BG;
                screen.append(loading);
                loading.load("Deleting...");
                client.deleteResource(namespace, apiResource, resource, (error) => {
                    if (error) {
                        throw error;
                    }
                    loading.stop();
                });
            });
    }
}
