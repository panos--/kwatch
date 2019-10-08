import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource } from "../api_resource";
import { AppContext } from "../app_context";

export class DeleteAction implements Action {
    public getLabel() {
        return "Delete";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.verbs.includes("delete");
    }

    public execute(ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        const question = ctx.widgetFactory.question({ parent: ctx.screen, width: 80 });
        question.data.okay.top = 5;
        question.data.cancel.top = 5;
        question.ask(
            `Delete ${apiResource.getSingularName()} ${resource}\n`
            + ` in namespace ${namespace.metadata.name}?`,
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
                loading.style.border.bg = ctx.colorScheme.COLOR_BORDER_BG;
                ctx.screen.append(loading);
                loading.load("Deleting...");
                ctx.client.deleteResource(namespace, apiResource, resource, false, (error) => {
                    loading.stop();
                    if (error) {
                        ctx.widgetFactory.error(
                            `Error deleting ${apiResource.getName()} ${resource}`
                            + `Reason: ${error.message}`);
                    }
                });
            });
    }
}
