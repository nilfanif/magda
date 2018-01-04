import * as _ from "lodash";

import Registry from "@magda/typescript-common/dist/registry/AuthorizedRegistryClient";
import { Record } from "@magda/typescript-common/dist/generated/registry/api";
import { RecordLayer } from "@magda/typescript-common/src/registry-manual/api";
import summarizeAspectDef, {
    SummarizeAspect,
    RetrieveResult
} from "./summarizeAspectDef";
import unionToThrowable from "@magda/typescript-common/src/util/unionToThrowable";
import {
    FormatSortedRecords,
    sortRecordsByFormat
} from "@magda/typescript-common/src/util/formatUtils/formatClassifier"

export default async function onRecordFound(
    record: Record,
    registry: Registry,
) {
    let recordLayers : RecordLayer[] = [];

    const distributions: Record[] =
        record.aspects["dataset-distributions"] &&
        record.aspects["dataset-distributions"].distributions;

    if (!distributions || distributions.length === 0) {
        return Promise.resolve();
    }

    // get all records grouped by their format
    const formatSortedRecords: void = sortRecordsByFormat(distributions);

    // put them into a record layer for the database
    /*formatSortedRecords.forEach(formatSortedRecord => {
        formatSortedRecord.records.forEach( record => {
            record.aspects["dcat-distribution-strings"].format = formatSortedRecord.format;
            recordLayers.push({
                record: record,
                layer: "format"
            });
        });
    });*/
}