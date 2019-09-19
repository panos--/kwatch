import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource } from "../client";
import { AppContext } from "../app_context";

export class ShowYamlAction implements Action {
    public getLabel() {
        return "Show YAML";
    }

    public appliesTo(): boolean {
        return true;
    }

    public execute(ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        ctx.client.getResourceAsYaml(namespace, apiResource, resource, (error, lines) => {
            const box = ctx.widgetFactory.textBox({
                parent: ctx.screen,
            });
            box.setLabel(
                (apiResource.resource.namespaced ? namespace.metadata.name + " / " : "")
                + apiResource.getCapitalizedSingularName() + " " + resource);

            if (error) {
                console.log(error.message);
                return;
            }
            else {
                box.insertBottom(lines);
            }

            box.focus();
            ctx.screen.render();
        });
    }
}
