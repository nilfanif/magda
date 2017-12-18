import * as _ from "lodash";
//import * as request from "request";
//import * as http from "http";
//import * as URI from "urijs";

//import retryBackoff from "@magda/typescript-common/dist/retryBackoff";
import Registry from "@magda/typescript-common/dist/registry/AuthorizedRegistryClient";
import { Record } from "@magda/typescript-common/dist/generated/registry/api";
//import unionToThrowable from "@magda/typescript-common/dist/util/unionToThrowable";
import {
    duplicateRecordsAspect,
    distURL,
} from "./duplicateRecordsAspectDef";
//import datasetQualityAspectDef from "@magda/sleuther-framework/dist/common-aspect-defs/datasetQualityAspectDef";
import FTPHandler from "./FtpHandler";

export default async function onRecordFound(
    record: Record,
    registry: Registry,
    retries: number = 5,
    baseRetryDelaySeconds: number = 1,
    base429RetryDelaySeconds = 60,
    ftpHandler: FTPHandler = new FTPHandler()
) {
    const distributions: Record[] =
    record.aspects["dataset-distributions"] &&
    record.aspects["dataset-distributions"].distributions;

    if (!distributions || distributions.length === 0) {
        return Promise.resolve();
    }

    // convert all distributions into a distContainer
    const distributionContainers = _.flatten(distributions.map(function(distribution) {

        let distContainer: distContainer[];

        distContainer[0].url = {
                url: distribution.aspects["dcat-distribution-strings"].accessURL as string,
                type: "accessURL" as "accessURL"
            } || {type: "none" };

        distContainer[1].url = {
                url: distribution.aspects["dcat-distribution-strings"].downloadURL as string,
                type: "downloadURL" as "downloadURL"
            } || { type: "none" };

        distContainer[0].id = distContainer[1].id = distribution.id;

        return distContainer;
    }))

    // distContainers ordered by url type
    //TODO check with Kev or Alex: can it be assumed that there will be no downloadURL and accessURLs that are the same?
    const orderedDistContainers = _(
        distributionContainers 
    )
    .groupBy(distContainer => {
        distContainer.url.url;
    })
    .values();

    // construct the appropriate aspect def using the ordered distContainers
    const duplicateGroups: duplicateRecordsAspect[] = 

}

interface distContainer {
    url: distURL;    
    id: string;
}

/*interface duplicateRecordsSleuthingResult {
    group: duplicateRecordsAspect;
}*/


