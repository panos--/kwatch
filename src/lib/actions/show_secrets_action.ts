import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";
import { WidgetFactory } from "../widget_factory";
import * as yaml from "js-yaml";

export class ShowSecretsAction implements Action {
    public getLabel() {
        return "Show secrets";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.name == "secrets";
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        client.getSecret(resource, namespace.metadata.name).then(secret => {
            for (let key of Object.keys(secret.data)) {
                secret.data[key] = Buffer.from(secret.data[key], "base64").toString();
            }
            const yamlSecret = yaml.safeDump(secret.data, {
                indent: 2,
                skipInvalid: true,
                sortKeys: true,
            });
            const box = WidgetFactory.textBox({
                parent: screen,
            });
            box.setLabel(
                (apiResource.resource.namespaced ? namespace.metadata.name + " / " : "")
                + apiResource.getCapitalizedSingularName() + " " + resource);
            box.setText(yamlSecret);
            box.focus();
            screen.render();
        }).catch(e => {
            console.log(e);
        });
    }
}
