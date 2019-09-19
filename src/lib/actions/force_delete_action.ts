import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource } from "../client";
import { AppContext } from "../app_context";

export class ForceDeleteAction implements Action {
    public getLabel() {
        return "Force Delete";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.verbs.includes("delete");
    }

    public execute(ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        const question = ctx.widgetFactory.question({ parent: ctx.screen, width: 80 });
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
                    parent: ctx.screen,
                    top: "center",
                    left: "center",
                    height: 5,
                    width: 13,
                    mouse: true,
                    keys: true,
                    border: "line",
                });
                loading.style.border.bg = ctx.colorScheme.COLOR_BORDER_BG;
                loading.load("Deleting...");
                ctx.client.deleteResource(namespace, apiResource, resource, true, (error) => {
                    if (error) {
                        throw error;
                    }
                    loading.stop();
                });
            });
    }
}
