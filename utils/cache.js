import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 60 }); // cache for 1 minute  
export default cache;