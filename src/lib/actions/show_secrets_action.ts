import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource } from "../client";
import { K8sUtils } from "../k8s_utils";
import { AppContext } from "../app_context";

export class ShowSecretsAction implements Action {
    public getLabel() {
        return "Show secrets";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.name == "secrets";
    }

    public execute(ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        ctx.client.getSecret(resource, namespace.metadata.name).then(secret => {
            const decodedSecret = K8sUtils.dataToString(K8sUtils.decodeSecretData(secret.data));
            const box = ctx.widgetFactory.textBox({
                parent: ctx.screen,
            });
            box.setLabel(
                (apiResource.resource.namespaced ? namespace.metadata.name + " / " : "")
                + apiResource.getCapitalizedSingularName() + " " + resource);
            box.setText(decodedSecret);
            box.focus();
            ctx.screen.render();
        }).catch(e => {
            console.log(e);
        });
    }
}
