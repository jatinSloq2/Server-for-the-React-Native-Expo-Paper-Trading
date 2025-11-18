import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 30 }); // cache for 1 minute  
export default cache;