import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource } from "../api_resource";
import { AppContext } from "../app_context";

export class DescribeAction implements Action {
    public getLabel() {
        return "Describe";
    }

    public appliesTo(): boolean {
        return true;
    }

    public execute(ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        ctx.client.describeResource(namespace, apiResource, resource)
            .then(lines => {
                const box = ctx.widgetFactory.textBox({
                    parent: ctx.screen,
                });
                box.style.border.bg = ctx.colorScheme.COLOR_BORDER_BG_FOCUS;
                box.setLabel(
                    (apiResource.resource.namespaced ? namespace.metadata.name + " / " : "")
                    + apiResource.getCapitalizedSingularName() + " " + resource);
                box.insertBottom(lines);
                box.focus();
                ctx.screen.render();
            }).catch(error => {
                ctx.widgetFactory.error(
                    `Error describing resource ${resource}\n\n`
                    + `Reason: ${error.message}`
                );
            });
    }
}
