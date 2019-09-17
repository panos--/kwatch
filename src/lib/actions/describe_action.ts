import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";
import { WidgetFactory } from "../widget_factory";
import { AppDefaults } from "../app_defaults";

export class DescribeAction implements Action {
    public getLabel() {
        return "Describe";
    }

    public appliesTo(): boolean {
        return true;
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        client.describeResource(namespace, apiResource, resource, (error, lines) => {
            const box = WidgetFactory.textBox({
                parent: screen,
            });
            box.style.border.bg = AppDefaults.COLOR_BORDER_BG_FOCUS;
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
            screen.render();
        });
    }
}
