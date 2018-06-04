import React from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import queryString from "query-string";
import AUbuttons from "@gov.au/buttons";
import { resetRegion } from "../../actions/datasetSearchActions";
import removePassiveIcon from "../../assets/remove-passive.svg";

const ClearAllButton = ({ location, history, dispatch }) => {
    const query = queryString.parse(location.search);
    if (
        !query.organisation &&
        !query.format &&
        !query.dateFrom &&
        !query.dateTo &&
        !query.regionId
    )
        return null;

    return (
        <div className="search-facet">
            <div className="facet-wrapper">
                <div className="facet-header">
                    <AUbuttons
                        as="secondary"
                        className="btn-facet"
                        onClick={() => {
                            console.log(location);
                            const query = queryString.parse(location.search);
                            const qStr = queryString.stringify({
                                q: query.q ? query.q : ""
                            });
                            //--- unfortunately, active Region needs to be reset
                            //--- to reset region header state
                            dispatch(resetRegion());
                            history.push({
                                pathname: "/search",
                                search: `?${qStr}`
                            });
                        }}
                    >
                        <img
                            className="facet-icon"
                            src={removePassiveIcon}
                            alt="Clear all button"
                        />
                        <span>Clear All</span>
                    </AUbuttons>
                </div>
            </div>
        </div>
    );
};

export default withRouter(connect()(ClearAllButton));
