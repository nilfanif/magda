import "./QualityIndicator.css";

import React from "react";
import StarRating from "./StarRating";
import Tooltip from "./Tooltip";

function QualityIndicator(props) {
    let rating = Math.ceil(parseFloat(props.quality).toFixed(2) * 10 / 2);

    if (rating < 0) {
        rating = 0;
    }

    return (
        <div className="quality-indicator">
            <span className="title">Open Data Quality:&nbsp;</span>
            <StarRating stars={rating} />
            <Tooltip />
        </div>
    );
}

export default QualityIndicator;
