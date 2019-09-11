import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";

export class DeleteAction implements Action {
    public getLabel() {
        return "Delete";
    }

    public appliesTo(): boolean {
        return true;
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        let question = blessed.question({
            top: "center",
            left: "center",
            height: "30%",
            width: "50%",
            mouse: true,
            keys: true,
            border: "line",
        });
        screen.append(question);
        question.ask(
            `Delete ${apiResource.getSingularName()} ${resource} `
            +` in namespace ${namespace.metadata.name}?`,
            (err, yes) => {
                if (!yes) {
                    return;
                }
                let loading = blessed.loading({
                    top: "center",
                    left: "center",
                    height: "30%",
                    width: "50%",
                    mouse: true,
                    keys: true,
                    border: "line",
                });
                screen.append(loading);
                loading.load(
                    `Deleting ${apiResource.getSingularName()} ${resource} `
                    +` in namespace ${namespace.metadata.name}...`);
                client.deleteResource(namespace, apiResource, resource, (error) => {
                    if (error) {
                        throw error;
                    }
                    loading.stop();
                });
            });
    }
}
