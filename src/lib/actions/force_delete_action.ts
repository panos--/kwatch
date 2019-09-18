import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";
import { WidgetFactory } from "../widget_factory";
import { AppDefaults } from "../app_defaults";

export class ForceDeleteAction implements Action {
    public getLabel() {
        return "Force Delete";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.verbs.includes("delete");
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        const question = WidgetFactory.question({ parent: screen, width: 80 });
        question.data.okay.top = 5;
        question.data.cancel.top = 5;
        question.ask(
            `Immediately delete ${apiResource.getSingularName()} ${resource}\n`
            + ` in namespace ${namespace.metadata.name}?\n`
            + " WARNING: This gives resources no time to shutdown gracefully!",
            (err, yes) => {
                if (!yes) {
                    return;
                }
                let loading = blessed.loading({
                    parent: screen,
                    top: "center",
                    left: "center",
                    height: 5,
                    width: 13,
                    mouse: true,
                    keys: true,
                    border: "line",
                });
                loading.style.border.bg = AppDefaults.COLOR_BORDER_BG;
                loading.load("Deleting...");
                client.deleteResource(namespace, apiResource, resource, true, (error) => {
                    if (error) {
                        throw error;
                    }
                    loading.stop();
                });
            });
    }
}
