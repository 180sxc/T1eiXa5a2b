// ==UserScript==
// @name         sacraficial1
// @author       lureee
// @match        ://*.mohmoh.eu/*
// @grant none
// @run-at document-start
// ==/UserScript==
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.tagName === 'SCRIPT' && node.src.includes('bundle.js')) {
                node.type = 'javascript/blocked';
            }
        });
    });
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

addEventListener("DOMContentLoaded", (event) => {
    const WorkerCode = `
self.onmessage = (msg) => {
    let bitmap = msg.data;
    let canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    let ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    ctx.clearRect(Math.floor(bitmap.width/2), Math.floor(bitmap.height/2), 1, 1);


    let endpoints = [];
    let data = ctx.getImageData(0,0,bitmap.width, bitmap.height).data;

    let map = new Map(canvas);


    for(let i = 0;i < data.length;i += 4){
        let l = i / 4;
        map.graph[l % bitmap.width][Math.floor(l / bitmap.width)].cost = data[i];
        if(data[i + 2]){
            endpoints.push({
                x: l % bitmap.width,
                y: Math.floor(l / bitmap.width),
            });
        }
    }
    bitmap.close();

    if(!endpoints.length){
        endpoints.push(map.getCentreNode());
    }

    //begin the pathfinding

    let openSet = new BinHeap();
    openSet.setCompare = (a, b) => a.f > b.f;
    openSet.push(map.getCentreNode());

    let currentNode;


    while(openSet.length){
        currentNode = openSet.remove(0)
        if(endpoints.some((goal) => goal.x == currentNode.x && goal.y == currentNode.y)){
            break;
        }

        let neighbors = map.getNeighbor(currentNode.x, currentNode.y);
        for(let i = 0;i < neighbors.length;i++){
            let neighbor = neighbors[i];
            if(neighbor && neighbor.cost == 0){//may make it weighted later
                let tempG = currentNode.g + Map[i % 2 == 0 ? "DiagonalCost" : "TraversalCost"];
                if(tempG < neighbor.g){
                    neighbor.parent = currentNode;
                    neighbor.g = tempG;
                    neighbor.h = Math.min.apply(Math, endpoints.map((goal) => fastHypot(neighbor.x - goal.x, neighbor.y - goal.y)));
                    if(!neighbor.inset){
                        openSet.insert(neighbor);
                    }
                }
            }
        }
    }


    //recontruct path
    if(!endpoints.some((goal) => goal.x == currentNode.x && goal.y == currentNode.y)){
        currentNode = map.getLowest('h');
    }
    let output = [];
    while(currentNode.parent){
        let nextNode = currentNode.parent;
        let d = Math.round(Math.atan2(nextNode.y - currentNode.y, nextNode.x - currentNode.x) / Math.PI * 4);
        if(d < 0){d+=8};
        output.push(d);
        currentNode = nextNode;
    }
    output = new Uint8Array(output.reverse()).buffer;

    self.postMessage(output, [output]);
}

//approximate hypot
function fastHypot(a, b){
    const c = Math.SQRT2-1;
    a = Math.abs(a);
    b = Math.abs(b);
    if(a > b){
        let temp = a;
        a = b;
        b = temp;
    }
    return (c * a) + b
}

//Map Constructor for object
class Map{
    static TraversalCost = 1;
    static DiagonalCost = Math.sqrt(2) * 1;
    constructor(canvas){
        //init variables
        this.width = canvas.width;
        this.height = canvas.height;

        this.middleWidth = Math.floor(this.width / 2);
        this.middleHeight = Math.floor(this.height / 2);

        this.graph = new Array(canvas.width);
        for(let x = 0;x < this.width;x++){
            this.graph[x] = new Array(this.height);
            for(let y = 0;y < this.height; y++){
                this.graph[x][y] = new Node(x, y);
            }
        }
        this.getCentreNode().g = 0;
        this.getCentreNode().pending = false;
    }
    getLowest(type){
        let lowestNode = this.graph[0][0];
        for(let x = 0;x < this.width;x++){
            for(let y = 0;y < this.height; y++){
                if(lowestNode[type] > this.getNode(x, y)[type]){
                    lowestNode = this.getNode(x, y);
                }
            }
        }
        return lowestNode;
    }
    getNode(x, y){
        if(this.graph[x]){
            return this.graph[x][y];
        }
    }
    getCentreNode(){
        return this.graph[this.middleWidth][this.middleHeight];
    }
    getNeighbor(x, y){
        return [
            this.getNode(x - 1, y - 1),
            this.getNode(x + 0, y - 1),
            this.getNode(x + 1, y - 1),
            this.getNode(x + 1, y + 0),
            this.getNode(x + 1, y + 1),
            this.getNode(x + 0, y + 1),
            this.getNode(x - 1, y + 1),
            this.getNode(x - 1, y + 0),
        ]
    }
}

//Node for Map
class Node{
    constructor(x, y){
        this.x = x;
        this.y = y;
        this.g = Number.POSITIVE_INFINITY;//distance to start
        this.h = Number.POSITIVE_INFINITY;//estimated distance to end
        this.parent;//where it came from
    }
    get f(){
        return this.h + this.g;
    }
}

//binary heap object constructor
class BinHeap extends Array {
    //private variable declaration
    #compare = (a, b) => a < b;
    //constuctor
    constructor(len = 0) {
        super(len);
    }
    //change compare function
    set setCompare(func) {
        if (typeof func == "function") {
            this.#compare = func;
        } else {
            throw new Error("Needs a function for comparing")
        }
    }
    //sort into a binary heap
    sort() {
        for (let i = Math.trunc(this.length / 2); i >= 0; i--) {
            this.siftDown(i)
        }
    }
    //old array sort
    arraySort(compare) {
        super.sort(compare)
    }
    //sift down
    siftDown(index) {
        let left = index * 2 + 1;
        let right = index * 2 + 2;
        let max = index;
        if (left < this.length && this.#compare(this[max], this[left])){
            max = left;
        }
        if (right < this.length && this.#compare(this[max], this[right])){
            max = right;
        }
        if (max != index) {
            this.swap(index, max);
            this.siftDown(max);
        }
    }
    //sift up
    siftUp(index) {
        let parent = (index - (index % 2 || 2)) / 2;
        if (parent >= 0 && this.#compare(this[parent], this[index])) {
            this.swap(index, parent);
            this.siftUp(parent);
        }
    }
    //inserts element into the binary heap
    insert(elem) {
        this.push(elem);
        this.siftUp(this.length - 1);
    }
    //removes elem at index from binary heap
    remove(index) {
        if (index < this.length) {
            this.swap(index, this.length - 1);
            let elem = super.pop();
            this.siftUp(index);
            this.siftDown(index);
            return elem;
        } else {
            throw new Error("Index Out Of Bounds")
        }
    }
    //changes elem at index
    update(index, elem) {
        if (index < this.length) {
            this[index] = elem;
            this.siftUp(index);
            this.siftDown(index);
        } else {
            throw new Error("Index Out Of Bounds")
        }
    }
    //swap two elem at indexes
    swap(i1, i2) {
        let temp = this[i1];
        this[i1] = this[i2];
        this[i2] = temp;
    }
}
`;
    let sz =750;
    let rs = 5;

    //pathfinding instance
    class WorkerAStar{
        constructor(size = 750, resolution = 5){
            //setup essential variables
            this.size = size;
            this.res = resolution;
            this.prevPos = {};
            this.prevPath = [];//might change
            this.oldPath = []

            //setup worker
            this.blob = new Blob([
                WorkerCode
            ], {
                type: "application/javascript"
            })
            this.url = URL.createObjectURL(this.blob);
            this.worker = new Worker(this.url);
            this.worker.url = this.url;

            //message receiving
            this.worker.onmessage = (msg) => {
                this.attemptFulfil(new Uint8Array(msg.data));
            }

            //error handling
            this.worker.onerror = (err) => {
                throw err;
            }

            this.initiateCanvas();

            //test canvas
            var canvasMap = document.createElement("CANVAS");
            canvasMap.id = 'canvasMap';
            document.body.append(canvasMap);
            canvasMap.style.zIndex = "-1";
            canvasMap.style = "position:absolute; left: 50%; top: 60px;margin-left:-100px; pointer-events: none; border-style:solid; color: rgba()";
            this.mapWriter = canvasMap.getContext("2d");
            canvasMap.style.display = "none";
            canvasMap.width = Math.ceil(this.size * 2 / this.res) + 1;
            canvasMap.height = Math.ceil(this.size * 2 / this.res) + 1;
        }
        //attempts to recieve a message
        attemptFulfil(msg, depth = 0){
            if(this.resolve){
                //relay message onward
                this.resolve(msg);
                this.resolve = null;
            }else{
                //allow 5 attempts to recieve
                if(depth < 5){
                    setTimeout(() => {
                        //could have just passed function as param, but this is more "consistent"
                        this.attemptFulfil(msg, depth + 1);
                    }, 0);
                }else{
                    console.error("Unexpected Message from Worker at ", this);
                }
            }
        }

        //gets new canvas
        initiateCanvas(){
            this.width = Math.ceil(this.size * 2 / this.res) + 1;
            if(this.canvas){
                this.canvas.width = this.width;
                this.canvas.height = this.width;
            }else{
                this.canvas = new OffscreenCanvas(this.width, this.width);
                this.ctx = this.canvas.getContext("2d");
            }
        }

        //setter for buildings
        setBuildings(buildings){
            this.buildings = buildings;
        }

        //set estimates speed
        setSpeed(spd){
            this.estimatedSpeed = spd;
        }

        //set pos in real time
        setPos(x, y){
            this.x = x;
            this.y = y;
        }

        //clear the previous path to force a recalculation
        clearPath(){
            this.prevPath = [];
            this.oldPath = []
        }
        drawPath(ctx, pathColor = "#0000FF", myPos = this, dirColor = "#00FF00"){
            if(this.prevPath.length){
                //draw path
                for(let point of this.prevPath){
                    let dist = Math.hypot(myPos.x - point.x, myPos.y - point.y);
                    ctx.strokeStyle = dist<50?"rgba(255,0,0,.5)":pathColor;
                }
                ctx.lineWidth = 3;
                ctx.beginPath();
                for(let i = 0;i < this.prevPath.length;i++){
                    ctx.lineTo(this.prevPath[i].x, this.prevPath[i].y);
                    ctx.moveTo(this.prevPath[i].x, this.prevPath[i].y);
                }
                ctx.stroke();
                for(let i = 0;i < this.prevPath.length;i++){
                    let dist = Math.hypot(myPos.x - this.prevPath[i].x, myPos.y - this.prevPath[i].y);
                    if(dist < 20){
                        this.oldPath.push(this.prevPath[i])
                    }
                }
                //draw movement dir
                if(myPos.x && myPos.y && false){
                    ctx.lineWidth = 5;
                    ctx.strokeStyle = dirColor;
                    ctx.beginPath();
                    for(let point of this.prevPath){
                        let dist = Math.hypot(myPos.x - point.x, myPos.y - point.y);
                        if(dist < this.estimatedSpeed + this.res * 2){
                            if(dist > this.estimatedSpeed){
                                ctx.moveTo(myPos.x, myPos.y);
                                ctx.lineTo(point.x, point.y);
                            }
                            break;
                        }
                    }
                    ctx.stroke();
                }
            }
        }

        //async function for recieving response
        async response(){
            return await new Promise((resolve) => {
                this.resolve = resolve;
            });
        }
        //attempt to get a path
        getPath(){
            window.pf = this;
            for(let i in this.prevPath){
                let point = this.prevPath[i];
                let dist = Math.hypot(this.x - point.x, this.y - point.y);
                if(dist < this.estimatedSpeed + this.res * 2){
                    if(dist > this.estimatedSpeed){
                        return {
                            ang: Math.atan2(point.y - this.y, point.x - this.x),
                            dist: parseInt(i),
                        };
                    }else{
                        break;
                    }
                }
            }
        }

        //makes position on the canvas(may improve, repl.it/@pyrwynd, project:test map)
        norm(value){
            return Math.max(0, Math.min(this.width - 1, value));
        }

        async initCalc(positions, append = false){
            //prevents multiple instances of calculation
            if(this.resolve){
                return;
            }

            //sets last position
            this.prevGoal = positions.map((elem) => {
                return {
                    x: elem.x,
                    y: elem.y,
                }
            })

            //modify position values
            if(append){
                this.prevPos = this.prevPath[0];
            }else{
                this.prevPos = {
                    x: this.x,
                    y: this.y,
                }
            }
            positions = positions.map((elem) => {
                return {
                    x: this.norm((elem.x - this.prevPos.x + this.size) / this.res),
                    y: this.norm((elem.y - this.prevPos.y + this.size) / this.res),
                }
            })

            //put buildings on canvas here
            const Circle = Math.PI * 2;
            this.ctx.fillStyle = "#FF0000";
            for(let obj of this.buildings){
                if(obj.active){
                    let x = (obj.x - this.prevPos.x + this.size) / this.res;
                    let y = (obj.y - this.prevPos.y + this.size) / this.res;
                    let r = obj.scale;

                    //modify radius of natural objects
                    if(obj.owner == null){
                        if(obj.type == 0){
                            //reduce tree hitbox by 40%(may be changed later)
                            r *= 0.6;
                        }else if(obj.type == 1){
                            //reduce bush hitbox by 25%(may be changed later)
                            r *= 0.75;
                            if(obj.x > 12000){
                                //cactus
                                r += 25;
                            }
                        }
                    }

                    //increase avoidance of spikes
                    if(obj.dmg){
                        r += 30;//number may vary
                    }

                    //account for player size
                    r += 18;

                    this.ctx.beginPath();
                    this.ctx.arc(x, y, r / this.res, 0, Circle);
                    this.ctx.fill();
                }
            }

            //draw destination on canvas
            this.ctx.fillStyle = "#fff";
            for(let goal of positions){
                this.ctx.fillRect(Math.round(goal.x), Math.round(goal.y), 1, 1);
            }

            //test canvas draw
            this.mapWriter.clearRect(0, 0, this.width, this.width);
            // this.mapWriter.drawImage(this.canvas, 0, 0);

            //instant data transfer(saves 10ms)
            let bitmap = await createImageBitmap(this.canvas, 0, 0, this.width, this.width);
            this.worker.postMessage(bitmap, [bitmap]);

            //meanwhile get a new canvas
            this.initiateCanvas();

            //wait until recieve data
            let data = await this.response();

            //turn into list of points
            const xTable = [-1, -1, 0, 1, 1, 1, 0, -1];
            const yTable = [0, -1, -1, -1, 0, 1, 1, 1];
            if(!append){
                this.prevPath = [];
                this.oldPath = [];
            }
            let currPos = {
                x: this.prevPos.x,
                y: this.prevPos.y,
            };
            let displayPos = {
                x: Math.floor(this.width/2),
                y: Math.floor(this.width/2),
            }
            for(let i = 0;i < data.length;i++){
                this.mapWriter
                currPos = {
                    x: currPos.x + xTable[data[i]] * this.res,
                    y: currPos.y + yTable[data[i]] * this.res,
                }
                displayPos = {
                    x: displayPos.x + xTable[data[i]],
                    y: displayPos.y + yTable[data[i]],
                }
                this.mapWriter.fillRect(displayPos.x, displayPos.y, 1, 1);

                this.prevPath.unshift(currPos);
            }
            return;
        }

        //requests a path/calculation
        async pathTo(positions){
            //fix positions
            if(!(positions instanceof Array)){
                positions = [positions];
            }

            //remove path if not matching
            if(this.prevGoal?.length == positions.length && this.prevGoal.every((elem, i) => elem.x == positions[i].x && elem.y == positions[i].y)){

                //reuse previous path if nearby
                let path = this.getPath();
                if(path){
                    if(path.dist < this.estimatedSpeed / this.res * 5){
                        this.initCalc(positions, true);
                    }
                    return path;
                }
            }

            await this.initCalc(positions);
            return this.getPath();
        }
    }


    var Pathfinder = new WorkerAStar();
    Pathfinder.setSpeed(1e3/9);


    //an interface to interact with the pathfinder
    class Tachyon{
        constructor(pathfinder){
            this.pathfinder = pathfinder;
            this.goal = {
                pathing: false,
                type: null,
                entity: null,
                pos: {
                    x: null,
                    y: null,
                },
            }
            this.waypoints = {
                death: {
                    x: null,
                    y: null,
                },
                quick: {
                    x: null,
                    y: null,
                },
            }
        }
        setWaypoint(name, pos){
            if(pos.x && pos.y){
                this.waypoints[name] = {
                    x: pos.x,
                    y: pos.y,
                }
            }
        }
        drawWaypointMap(mapCtx, canvas){
            mapCtx.font = "34px Hammersmith One";
            mapCtx.textBaseline = "middle";
            mapCtx.textAlign = "center";
            for(let tag in this.waypoints){
                if(tag == "death"){
                    mapCtx.fillStyle = "#E44";
                }else if(tag == "quick"){
                    mapCtx.fillStyle = "#44E";
                }else{
                    mapCtx.fillStyle = "#fff";
                }
                if(this.waypoints[tag].x && this.waypoints[tag].y){
                    mapCtx.fillText("x", this.waypoints[tag].x / 14400 * canvas.width, this.waypoints[tag].y / 14400 * canvas.height);
                }
            }
            mapCtx.strokeStyle = "#4E4";
            if(this.goal.type == "xpos"){
                mapCtx.beginPath();
                mapCtx.moveTo(this.goal.pos.x / 14400 * canvas.width, 0);
                mapCtx.lineTo(this.goal.pos.x / 14400 * canvas.width, canvas.height);
                mapCtx.stroke();
            }else if(this.goal.type == "ypos"){
                mapCtx.beginPath();
                mapCtx.moveTo(0, this.goal.pos.y / 14400 * canvas.height);
                mapCtx.lineTo(canvas.width, this.goal.pos.y / 14400 * canvas.height);
                mapCtx.stroke();
            }else if(this.goal.pos.x && this.goal.pos.y){
                mapCtx.fillStyle = "#4E4";
                mapCtx.fillText("x", this.goal.pos.x / 14400 * canvas.width, this.goal.pos.y / 14400 * canvas.height);
            }
        }
        drawWaypoints(ctx, theta){
            //waypoints
            for(let tag in this.waypoints){
                if(tag == "death"){
                    ctx.strokeStyle = "#E44";
                }else if(tag == "quick"){
                    ctx.strokeStyle = "#44E";
                }else{
                    ctx.strokeStyle = "#fff";
                }
                if(this.waypoints[tag].x && this.waypoints[tag].y){
                    ctx.save();
                    ctx.translate(this.waypoints[tag].x, this.waypoints[tag].y);
                    ctx.rotate(theta);
                    ctx.globalAlpha = 0.6;
                    ctx.lineWidth = 8;
                    for(let i = 0;i < 4;i++){
                        //spinning thing
                        ctx.rotate(i * Math.PI / 2);
                        ctx.beginPath();
                        ctx.arc(0, 0, 50, 0, Math.PI / 4);
                        ctx.stroke();
                    }
                    //pulsing thing
                    ctx.lineWidth = 6;
                    ctx.globalAlpha = Math.min(0.4, 1 - Math.pow(Math.sin(theta / 2), 2) / 1.2);
                    ctx.beginPath();
                    ctx.arc(0, 0, 50 + Math.max(0, Math.tan(theta / 2)), 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            //goal
            /*ctx.strokeStyle = "#4F4";
        ctx.lineWidth = 10;
        ctx.globalAlpha = 0.8;
        if(this.goal.type == "xpos"){
            ctx.beginPath();
            ctx.moveTo(this.goal.pos.x, 0);
            ctx.lineTo(this.goal.pos.x, 14400);
            ctx.stroke();
        }else if(this.goal.type == "ypos"){
            ctx.beginPath();
            ctx.moveTo(0, this.goal.pos.y);
            ctx.lineTo(14400, this.goal.pos.y);
            ctx.stroke();
        }else if(this.goal.pos.x && this.goal.pos.y){
            ctx.save();
            ctx.translate(this.goal.pos.x, this.goal.pos.y);
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2)
            ctx.stroke();
            ctx.beginPath();
            ctx.rotate(theta / 3);
            let r = Math.cos(theta) * 10;
            for(let i = 0;i < 3;i++){
                ctx.rotate(Math.PI * 2 / 3);
                ctx.moveTo(60 + r, 0);
                ctx.lineTo(120 + r, -20);
                ctx.lineTo(100 + r, 0);
                ctx.lineTo(120 + r, 20);
                ctx.closePath();
            }
            ctx.stroke();
            ctx.restore();
        }*/
        }
        setSelf(self){
            this.self = self;
        }
        setSend(sender){
            this.send = sender;
        }
        //ideas: https://github.com/cabaletta/baritone/blob/master/USAGE.md
        /**Current Commands
	 * path
	 * stop
	 * goal
	 * <goal/goto> x [Number: x position]
	 * <goal/goto> y [Number: y position]
	 * <goal/goto> [x: Number] [y: Number]
	 * waypoint set [name: String]
	 * waypoint del [name: String]
	 * waypoint goto [name: String]
	 * follow player <[ID/Name: Any]/all(default)>
	 * follow animal <[ID/Name: Any]/all(default)>
     * wander
	 **Planned Commands
	 * multigoal [wp1: String] ...
	 * find [id: Number]
	 * find [name: String] [owner(optional): Number]
	*/
        abort(){
            this.goal.pathing = false;
        }
        updateChat(txt, ownerID){
            //handle commands here
            if(ownerID != this.self.sid){
                return;
            }

            let args = txt.trimEnd().split(" ");

            if(args[0] == "path"){
                //start pathfinding(assuming there is a goal)
                if(this.goal.type){
                    this.goal.pathing = true;
                    this.pathfinder.clearPath();
                    console.log('ez')
                }
            }else if(args[0] == "stop"){
                if(this.goal.pathing){
                    this.goal.pathing = false;
                    this.pathfinder.clearPath();
                    this.send("33", null);
                }
            }else if(args[0] == "goal" || args[0] == "goto"){
                //goal sets goal
                //goto sets a path and starts walking towards it
                if(isNaN(parseInt(args[1]))){
                    if(args[1] == "x"){
                        //get to a x position
                        //<goal/goto> x [Number: x position]
                        let pos = parseInt(args[2]);
                        if(pos >= 0 && pos <= 14400){
                            this.goal.pathing = args[0] == "goto";
                            this.goal.type = "xpos";
                            this.goal.pos.x = pos;
                        }
                    }else if(args[1] == "y"){
                        //get to a y position
                        //<goal/goto> y [Number: y position]
                        let pos = parseInt(args[2]);
                        if(pos >= 0 && pos <= 14400){
                            this.goal.pathing = args[0] == "goto";
                            this.goal.type = "ypos";
                            this.goal.pos.y = pos;
                        }
                    }else if(args[0] == "goal" && !args[1]){
                        this.goal.type = "pos";
                        this.goal.pos.x = this.self.x;
                        this.goal.pos.y = this.self.y;
                    }
                }else{
                    //get to a x and y position
                    //<goal/goto> [x: Number] [y: Number]
                    let xPos = parseInt(args[1]);
                    let yPos = parseInt(args[2]);
                    if(xPos >= 0 && xPos <= 14400 && yPos >= 0 && yPos <= 14400){
                        this.goal.pathing = args[0] == "goto";
                        this.goal.type = "pos";
                        this.goal.pos.x = xPos;
                        this.goal.pos.y = yPos;
                    }
                }
            }else if(args[0] == "thisway" || args[0] == "project"){
                //project my position x distance from my position
                //thisway [distance: Number] [angle(optional): Number]
                let amt = parseInt(args[1]);
                let dir = parseFloat(args[2]) || this.self.dir;
                if(!isNaN(amt) && this.self.x && this.self.y && this.self.dir){
                    this.goal.type = "pos";
                    this.goal.pos.x = Math.max(0, Math.min(14400, this.self.x + Math.cos(dir) * amt));
                    this.goal.pos.y = Math.max(0, Math.min(14400, this.self.y + Math.sin(dir) * amt));
                }
            }else if(args[0] == "follow" || args[0] == "flw"){
                if(args[1] == "player" || args[1] == "ply"){
                    //follow player <[ID: Number]/all(default)>
                    this.goal.pathing = true;
                    this.goal.type = "player";
                    if(args[2]){
                        this.goal.entity = args.slice(2).join(" ");
                    }else{
                        this.goal.entity = -1;
                    }
                }else if(args[1] == "team"){
                    //follow team
                    this.goal.pathing = true;
                    this.goal.type = "team";
                }else if(args[1] == "animal"){
                    this.goal.pathing = true;
                    this.goal.type = "animal";
                    if(args[2]){
                        this.goal.entity = args[2];
                    }else{
                        this.goal.entity = -1;
                    }
                }
            }else if(args[0] == "find" || args[0] == "fnd"){
                //finds a object: natural or placed
                //find [id: Number]
                //find [name: String] [owner(optional): Number]
            }else if(args[0] == "waypoint" || args[0] == "wp"){
                if(args[1] == "set"){
                    //waypoint set [name: String]
                    if(Boolean(args[2]) && !this.waypoints[args[2]]){
                        this.waypoints[args[2]] = {
                            x: this.self.x,
                            y: this.self.y,
                        }
                    }
                }else if(args[1] == "del"){
                    //waypoint del [name: String]
                    delete this.waypoints[args[2]];
                }else if(args[1] == "goto"){
                    //waypoint goto [name: String]
                    if(this.waypoints[args[2]]?.x && this.waypoints[args[2]]?.y){
                        this.goal.pathing = true;
                        this.goal.type = "pos";
                        this.goal.pos.x = this.waypoints[args[2]].x;
                        this.goal.pos.y = this.waypoints[args[2]].y;
                    }
                }
            }else if(args[0] == "wander" || args[0] == "wnd"){
                this.goal.pathing = true;
                this.goal.type = "wander";
                this.goal.pos.x = Math.random() * 14400;
                this.goal.pos.y = Math.random() * 14400;
            }
        }
        //determines if we are nearing goal
        reachedGoal(){
            if(this.goal.type == "xpos"){
                return Math.abs(this.self.x - this.goal.pos.x) < this.pathfinder.estimatedSpeed;
            }else if(this.goal.type == "ypos"){
                return Math.abs(this.self.y - this.goal.pos.y) < this.pathfinder.estimatedSpeed;
            }else if(this.goal.type == "pos" || this.goal.type == "wander"){
                return Math.hypot(this.self.x - this.goal.pos.x, this.self.y - this.goal.pos.y) < this.pathfinder.estimatedSpeed;
            }
        }
        async updatePlayers(players){
            if(this.goal.pathing){
                let finalGoal;
                if(this.goal.type == "xpos"){
                    //go towards x position
                    finalGoal = [];
                    for(let i = -this.pathfinder.size; i <= this.pathfinder.size; i++){
                        finalGoal.push({
                            x: this.goal.pos.x,
                            y: this.self.y + i * this.pathfinder.res,
                        })
                    }
                }else if(this.goal.type == "ypos"){
                    //go towards y position
                    finalGoal = [];
                    for(let i = -this.pathfinder.size; i <= this.pathfinder.size;i += 3){
                        finalGoal.push({
                            x: this.self.x + i * this.pathfinder.res,
                            y: this.goal.pos.y,
                        })
                    }
                }else if(this.goal.type == "pos" || this.goal.type == "wander"){
                    //simple go towards position
                    finalGoal = {
                        x: this.goal.pos.x,
                        y: this.goal.pos.y,
                    };
                }else if(this.goal.type == "player"){
                    //do pathfinding for following player
                    if(this.goal.entity === -1){
                        finalGoal = [];
                        for(let player of players){
                            if(player.visible && player.sid != this.self.sid){
                                finalGoal.push(player)
                            }
                        }
                        if(!finalGoal.length){
                            finalGoal = null;
                        }
                    }else{
                        for(let player of players){
                            if(player.visible && player.sid != this.self.sid && (player.sid == this.goal.entity || player.name == this.goal.entity)){
                                finalGoal = player;
                                break;
                            }
                        }
                    }
                }else if(this.goal.type == "team"){
                    //follow teammates
                    finalGoal = [];
                    for(let player of players){
                        if(player.team == this.self.team && player.sid != this.self.sid){
                            finalGoal.push(player)
                        }
                    }
                    if(!finalGoal.length || !this.self.team){
                        finalGoal = null;
                    }
                }
                if(finalGoal){
                    if(this.reachedGoal()){
                        if(this.goal.type == "wander"){
                            this.goal.pos.x = Math.random() * 14400;
                            this.goal.pos.y = Math.random() * 14400;
                        }else{
                            this.goal.pathing = false;
                        }
                        this.pathfinder.clearPath();
                        this.send("33", null);
                    }else{
                        let path = await Pathfinder.pathTo(finalGoal);
                        if(path){
                            this.send("33", path.ang);
                        }else{
                            this.send("33", null);
                        }
                    }
                }
            }
        }
        async updateAnimals(animals){
            if(this.goal.type == "animal" && this.goal.pathing){
                let finalGoal;
                if(this.goal.entity === -1){
                    finalGoal = [];
                    for(let animal of animals){
                        if(animal.visible && animal.sid != this.self.sid){
                            finalGoal.push(animal)
                        }
                    }
                    if(!finalGoal.length){
                        finalGoal = null;
                    }
                }else{
                    for(let animal of animals){
                        if(animal.visible && (animal.sid == this.goal.entity || animal.name == this.goal.entity)){
                            finalGoal = animal;
                            break;
                        }
                    }
                }
                if(this.reachedGoal()){
                    this.pathfinder.clearPath();
                    this.goal.pathing = false;
                    this.send("33", null);
                }else if(finalGoal){
                    let path = await this.pathfinder.pathTo(finalGoal);
                    if(path){
                        this.send("33", path.ang);
                    }else{
                        this.send("33", null);
                    }
                }
            }
        }
        async addBuilding(obj){
            await new Promise((resolve) => {
                let id = setInterval(() => {
                    if(!this.pathfinder.resolve){
                        resolve();
                        clearInterval(id);
                    }
                })
                })
            let path = this.pathfinder.getPath();
            let dist = path?.dist + this.pathfinder.estimatedSpeed / this.pathfinder.res + 3;
            dist = Math.min(this.pathfinder.prevPath.length - 1, Math.trunc(dist));
            if(dist){
                for(let i = dist; i >= 0; i--){
                    let point = this.pathfinder.prevPath[i];
                    if(Math.hypot(point.x - obj.x, point.y - obj.y) < obj.scale + 30){
                        this.pathfinder.prevPath = this.pathfinder.prevPath.slice(i);
                        break;
                    }
                }
            }
        }
    }

    var Tach = new Tachyon(Pathfinder);
    var webpackModules = [function(e, t, i) {
        (function(t) {
            e.exports.maxScreenWidth = 2000,
                e.exports.maxScreenHeight = 1120,
                e.exports.serverUpdateRate = 9,
                e.exports.maxPlayers = 100,
                e.exports.maxPlayersHard = e.exports.maxPlayers + 10,
                e.exports.collisionDepth = 6,
                e.exports.minimapRate = 3e3,
                e.exports.colGrid = 10,
                e.exports.clientSendRate = 5,
                e.exports.healthBarWidth = 50,
                e.exports.healthBarPad = 3,
                e.exports.iconPadding = 15,
                e.exports.iconPad = .9,
                e.exports.deathFadeout = 3e3,
                e.exports.crownIconScale = 60,
                e.exports.crownPad = 35,
                e.exports.chatCountdown = 3e3,
                e.exports.chatCooldown = 500,
                e.exports.inSandbox = true,
                e.exports.maxAge = 100,
                e.exports.gatherAngle = Math.PI / 2.6,
                e.exports.gatherWiggle = 10,
                e.exports.hitReturnRatio = .25,
                e.exports.hitAngle = Math.PI / 2,
                e.exports.playerScale = 35,
                e.exports.playerSpeed = .0016,
                e.exports.playerDecel = .993,
                e.exports.nameY = 34,
                e.exports.skinColors = ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373"],
                e.exports.animalCount = 7,
                e.exports.aiTurnRandom = .06,
                e.exports.cowNames = ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper", "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison", "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"],
                e.exports.shieldAngle = Math.PI / 3,
                e.exports.weaponVariants = [{
                    id: 0,
                    src: "",
                    xp: 0,
                    val: 1
                }, {
                    id: 1,
                    src: "_g",
                    xp: 3e3,
                    val: 1.1
                }, {
                    id: 2,
                    src: "_d",
                    xp: 7e3,
                    val: 1.18
                }, {
                    id: 3,
                    src: "_r",
                    poison: !0,
                    xp: 12e3,
                    val: 1.18
                }],
                e.exports.fetchVariant = function(t) {
                for (var i = t.weaponXP[t.weaponIndex] || 0, n = e.exports.weaponVariants.length - 1; n >= 0; --n)
                    if (i >= e.exports.weaponVariants[n].xp)
                        return e.exports.weaponVariants[n]
            },
                e.exports.resourceTypes = ["wood", "food", "stone", "points"],
                e.exports.areaCount = 7,
                e.exports.treesPerArea = 9,
                e.exports.bushesPerArea = 3,
                e.exports.totalRocks = 32,
                e.exports.goldOres = 7,
                e.exports.riverWidth = 724,
                e.exports.riverPadding = 114,
                e.exports.waterCurrent = .0011,
                e.exports.waveSpeed = 1e-4,
                e.exports.waveMax = 1.3,
                e.exports.treeScales = [150, 160, 165, 175],
                e.exports.bushScales = [80, 85, 95],
                e.exports.rockScales = [80, 85, 90],
                e.exports.snowBiomeTop = 2400,
                e.exports.snowSpeed = .75,
                e.exports.maxNameLength = 15,
                e.exports.mapScale = 14400,
                e.exports.mapPingScale = 40,
                e.exports.mapPingTime = 2200
        }).call(this, i(5))
    }, function(e, t) {
        var i = {
            utf8: {
                stringToBytes: function(e) {
                    return i.bin.stringToBytes(unescape(encodeURIComponent(e)))
                },
                bytesToString: function(e) {
                    return decodeURIComponent(escape(i.bin.bytesToString(e)))
                }
            },
            bin: {
                stringToBytes: function(e) {
                    for (var t = [], i = 0; i < e.length; i++)
                        t.push(255 & e.charCodeAt(i));
                    return t
                },
                bytesToString: function(e) {
                    for (var t = [], i = 0; i < e.length; i++)
                        t.push(String.fromCharCode(e[i]));
                    return t.join("")
                }
            }
        };
        e.exports = i
    }, function(e, t, i) {
        "use strict";
        window.loadedScript = !0;
        var n = "127.0.0.1" !== location.hostname && !location.hostname.startsWith("192.168.");
        i(3);
        var bC = i(40),
            s = i(4),
            o = i(6),
            a = i(7),
            r = i(0),
            c = i(8),
            l = i(9),
            h = (i(10), i(11)),
            u = i(12),
            d = i(19),
            f = i(20),
            p = i(21),
            g = i(22).obj,
            m = new a.TextManager,
            y = new(i(23))("moomoo.io", 3e3, r.maxPlayers, 5, !1);
        y.debugLog = !1;
        var k = !1;

        function w() {
            lt && ht && (k = !0,
                         n ? window.grecaptcha.execute("6LcuxskpAAAAADyVCDYxrXrKEG4w-utU5skiTBZH", {
                action: "homepage"
            }).then((function(e) {
                v(e)
            })) : v(null))
        }

        function v(e) {
            y.start((function(t, i, a) {
                var c = (n ? "wss" : "ws") + "://" + t + ":8008/?gameIndex=" + a;
                e && (c += "&token=" + encodeURIComponent(e)),
                    s.connect(c, (function(e) {
                    Mn(),
                        setInterval(() => Mn(), 1000),
                        e ? ut(e) : (he.onclick = o.checkTrusted((function() {
                        ! function() {
                            var e = ++yt > 1,
                                t = Date.now() - mt > gt;
                            e && t ? (mt = Date.now(),
                                      kt()) : ki()
                        }()
                    })),
                                     o.hookTouchEvents(he),
                                     ue.onclick = o.checkTrusted((function() {
                        Pn("https://krunker.io/?play=SquidGame_KB")
                    })),
                                     o.hookTouchEvents(ue),
                                     fe.onclick = o.checkTrusted((function() {
                        setTimeout((function() {
                            ! function() {
                                var e = be.value,
                                    t = prompt("party key", e);
                                t && (window.onbeforeunload = void 0,
                                      window.location.href = "/?server=" + t)
                            }()
                        }), 10)
                    })),
                                     o.hookTouchEvents(fe),
                                     pe.onclick = o.checkTrusted((function() {
                        Ce.classList.contains("showing") ? (Ce.classList.remove("showing"),
                                                            ge.innerText = "Settings") : (Ce.classList.add("showing"),
                                                                                          ge.innerText = "Close")
                    })),
                                     o.hookTouchEvents(pe),
                                     me.onclick = o.checkTrusted((function() {
                        ui(),
                            "block" != qe.style.display ? Bt() : qe.style.display = "none"
                    })),
                                     o.hookTouchEvents(me),
                                     ye.onclick = o.checkTrusted((function() {
                        "block" != Je.style.display ? (Je.style.display = "block",
                                                       qe.style.display = "none",
                                                       ei(),
                                                       qt()) : Je.style.display = "none"
                    })),
                                     o.hookTouchEvents(ye),
                                     ke.onclick = o.checkTrusted((function() {
                        $t()
                    })),
                                     o.hookTouchEvents(ke),
                                     Ge.onclick = o.checkTrusted((function() {
                        mi()
                    })),
                                     o.hookTouchEvents(Ge),
                                     function() {
                        for (var e = 0; e < Pi.length; ++e) {
                            var t = new Image;
                            t.onload = function() {
                                this.isLoaded = !0
                            },
                                t.src = ".././img/icons/" + Pi[e] + ".png",
                                Ci[Pi[e]] = t
                        }
                    }(),
                                     Pe.style.display = "none",
                                     Me.style.display = "block",
                                     Le.value = M("moo_name") || "",
                                     function() {
                        var e = M("native_resolution");
                        Yt(e ? "true" == e : "undefined" != typeof cordova),
                            P = "true" == M("show_ping"),
                            Ie.hidden = !P,
                            M("moo_moosic"),
                            setInterval((function() {
                            window.cordova && (document.getElementById("downloadButtonContainer").classList.add("cordova"),
                                               document.getElementById("mobileDownloadButtonContainer").classList.add("cordova"))
                        }), 1e3),
                            Kt(),
                            o.removeAllChildren(Oe);
                        for (var t = 0; t < l.weapons.length + l.list.length; ++t)
                            ! function(e) {
                                o.generateElement({
                                    id: "actionBarItem" + e,
                                    class: "actionBarItem",
                                    style: "display:none",
                                    onmouseout: function() {
                                        wt()
                                    },
                                    parent: Oe
                                })
                            }(t);
                        for (t = 0; t < l.list.length + l.weapons.length; ++t)
                            ! function(e) {
                                var t = document.createElement("canvas");
                                t.width = t.height = 66;
                                var i = t.getContext("2d");
                                if (i.translate(t.width / 2, t.height / 2),
                                    i.imageSmoothingEnabled = !1,
                                    i.webkitImageSmoothingEnabled = !1,
                                    i.mozImageSmoothingEnabled = !1,
                                    l.weapons[e]) {
                                    i.rotate(Math.PI / 4 + Math.PI);
                                    var n = new Image;
                                    Yi[l.weapons[e].src] = n,
                                        n.onload = function() {
                                        this.isLoaded = !0;
                                        var n = 1 / (this.height / this.width),
                                            s = l.weapons[e].iPad || 1;
                                        i.drawImage(this, -t.width * s * r.iconPad * n / 2, -t.height * s * r.iconPad / 2, t.width * s * n * r.iconPad, t.height * s * r.iconPad),
                                            i.fillStyle = "rgba(0, 0, 70, 0.1)",
                                            i.globalCompositeOperation = "source-atop",
                                            i.fillRect(-t.width / 2, -t.height / 2, t.width, t.height),
                                            document.getElementById("actionBarItem" + e).style.backgroundImage = "url(" + t.toDataURL() + ")"
                                    },
                                        n.src = ".././img/weapons/" + l.weapons[e].src + ".png",
                                        (s = document.getElementById("actionBarItem" + e)).onmouseover = o.checkTrusted((function() {
                                        wt(l.weapons[e], !0)
                                    })),
                                        s.onclick = o.checkTrusted((function() {
                                        yi(e, !0)
                                    })),
                                        o.hookTouchEvents(s)
                                } else {
                                    n = Zi(l.list[e - l.weapons.length], !0);
                                    var s, a = Math.min(t.width - r.iconPadding, n.width);
                                    i.globalAlpha = 1,
                                        i.drawImage(n, -a / 2, -a / 2, a, a),
                                        i.fillStyle = "rgba(0, 0, 70, 0.1)",
                                        i.globalCompositeOperation = "source-atop",
                                        i.fillRect(-a / 2, -a / 2, a, a),
                                        document.getElementById("actionBarItem" + e).style.backgroundImage = "url(" + t.toDataURL() + ")",
                                        (s = document.getElementById("actionBarItem" + e)).onmouseover = o.checkTrusted((function() {
                                        wt(l.list[e - l.weapons.length])
                                    })),
                                        s.onclick = o.checkTrusted((function() {
                                        yi(e - l.weapons.length)
                                    })),
                                        o.hookTouchEvents(s)
                                }
                            }(t);
                        Le.ontouchstart = o.checkTrusted((function(e) {
                            e.preventDefault();
                            var t = prompt("enter name", e.currentTarget.value);
                            t && (e.currentTarget.value = t.slice(0, 15))
                        })),
                            xe.checked = C,
                            xe.onchange = o.checkTrusted((function(e) {
                            Yt(e.target.checked)
                        })),
                            Se.checked = P,
                            Se.onchange = o.checkTrusted((function(e) {
                            P = Se.checked,
                                Ie.hidden = !P,
                                T("show_ping", P ? "true" : "false")
                        }))
                    }())
                }), {
                    id: st,
                    d: ut,
                    1: vi,
                    2: gn,
                    4: mn,
                    33: vn,
                    5: ji,
                    6: on,
                    a: un,
                    aa: hn,
                    7: Fi,
                    8: an,
                    sp: rn,
                    9: kn,
                    h: wn,
                    11: Si,
                    12: Ti,
                    13: Ii,
                    14: yn,
                    15: Bi,
                    16: Oi,
                    17: Nt,
                    18: cn,
                    19: ln,
                    20: Cn,
                    ac: Ct,
                    ad: Ot,
                    an: Tt,
                    st: Pt,
                    sa: Et,
                    us: Vt,
                    ch: si,
                    mm: Ft,
                    t: bi,
                    p: _t,
                    pp: Tn
                }),
                    ft(),
                    setTimeout(() => pt(), 3e3)
            }), (function(e) {
                console.error("Vultr error:", e),
                    alert("Error:\n" + e),
                    ut("disconnected")
                Ee.style.display = "none"
            }))
        }
        var b, x = new g(r, o),
            S = Math.PI,
            I = 2 * S;

        function T(e, t) {
            b && localStorage.setItem(e, t)
        }

        function M(e) {
            return b ? localStorage.getItem(e) : null
        }
        Math.lerpAngle = function(e, t, i) {
            Math.abs(t - e) > S && (e > t ? t += I : e += I);
            var n = t + (e - t) * i;
            return n >= 0 && n <= I ? n : n % I
        },
            CanvasRenderingContext2D.prototype.roundRect = function(e, t, i, n, s) {
            return i < 2 * s && (s = i / 2),
                n < 2 * s && (s = n / 2),
                s < 0 && (s = 0),
                this.beginPath(),
                this.moveTo(e + s, t),
                this.arcTo(e + i, t, e + i, t + n, s),
                this.arcTo(e + i, t + n, e, t + n, s),
                this.arcTo(e, t + n, e, t, s),
                this.arcTo(e, t, e + i, t, s),
                this.closePath(),
                this
        },
            "undefined" != typeof Storage && (b = !0);
        var C, P, E, O, B, j, A, D, U, R, L, z, _, F, H = M("moofoll"),
            V = 1,
            q = Date.now(),
            W = [],
            X = [],
            G = [],
            N = [],
            Y = [],
            K = new p(f, Y, X, W, tt, l, r, o),
            J = i(35),
            Q = i(36),
            $ = new J(W, Q, X, l, null, r, o),
            Z = 1,
            ee = 0,
            te = 0,
            ie = 0,
            ne = {
                id: -1,
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0
            },
            se = {
                id: -1,
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0
            },
            oe = 0,
            ae = r.maxScreenWidth,
            re = r.maxScreenHeight,
            ce = !1,
            le = (document.getElementById("ad-container"),
                  document.getElementById("mainMenu")),
            he = document.getElementById("enterGame"),
            ue = document.getElementById("promoImg"),
            de = document.getElementById("partyButton"),
            fe = document.getElementById("joinPartyButton"),
            pe = document.getElementById("settingsButton"),
            ge = pe.getElementsByTagName("span")[0],
            me = document.getElementById("allianceButton"),
            ye = document.getElementById("storeButton"),
            ke = document.getElementById("chatButton"),
            we = document.getElementById("gameCanvas"),
            ve = we.getContext("2d"),
            be = document.getElementById("serverBrowser"),
            xe = document.getElementById("nativeResolution"),
            Se = document.getElementById("showPing"),
            Ie = (document.getElementById("playMusic"),
                  document.getElementById("pingDisplay")),
            Te = document.getElementById("shutdownDisplay"),
            Me = document.getElementById("menuCardHolder"),
            Ce = document.getElementById("guideCard"),
            Pe = document.getElementById("loadingText"),
            Ee = document.getElementById("gameUI"),
            Oe = document.getElementById("actionBar"),
            Be = document.getElementById("scoreDisplay"),
            je = document.getElementById("foodDisplay"),
            Ae = document.getElementById("woodDisplay"),
            De = document.getElementById("stoneDisplay"),
            Ue = document.getElementById("killCounter"),
            Re = document.getElementById("leaderboardData"),
            Le = document.getElementById("nameInput"),
            ze = document.getElementById("itemInfoHolder"),
            _e = document.getElementById("ageText"),
            Fe = document.getElementById("ageBarBody"),
            He = document.getElementById("upgradeHolder"),
            Ve = document.getElementById("upgradeCounter"),
            qe = document.getElementById("allianceMenu"),
            We = document.getElementById("allianceHolder"),
            Xe = document.getElementById("allianceManager"),
            Ge = document.getElementById("mapDisplay"),
            Ne = document.getElementById("diedText"),
            Ye = document.getElementById("skinColorHolder"),
            Ke = Ge.getContext("2d");
        Ge.width = 300,
            Ge.height = 300;
        var Je = document.getElementById("storeMenu"),
            Qe = document.getElementById("storeHolder"),
            $e = document.getElementById("noticationDisplay"),
            Ze = d.hats,
            et = d.accessories,
            tt = new h(c, N, o, r),
            it = "#525252",
            nt = "#3d3f42";
        var items = l,
            store = d,
            config = r,
            utils = o;
        window.addEventListener("wheel", function(e, t = [null, 0]) {
            if (e.deltaY > 0) {
                if(ae < 5000 && menuhidden){
                    t[0] = setInterval(() => {
                        if(t[1] >= 10) clearInterval(t[0]);
                        ae *= 1.005;
                        re *= 1.005;
                        oi()
                        t[1]++;
                    },5);
                }
            } else {
                if(ae > 1000 && menuhidden){
                    t[0] = setInterval(() => {
                        if(t[1] >= 10) clearInterval(t[0]);
                        ae /= 1.005;
                        re /= 1.005;
                        oi()
                        t[1]++;
                    },5);
                }
            }
        });
        function st(e) {
            G = e.teams
        }
        var ot = document.getElementById("featuredYoutube"),
            at = [{
                name: "Corrupt X",
                link: "https://www.youtube.com/channel/UC0UH2LfQvBSeH24bmtbmITw"
            }, {
                name: "Tweak Big",
                link: "https://www.youtube.com/channel/UCbwvzJ38AndDTkoX8sD9YOw"
            }, {
                name: "Arena Closer",
                link: "https://www.youtube.com/channel/UCazucVSJqW-kiHMIhQhD-QQ"
            }, {
                name: "Godenot",
                link: "https://www.youtube.com/user/SirGodenot"
            }, {
                name: "RajNoobTV",
                link: "https://www.youtube.com/channel/UCVLo9brXBWrCttMaGzvm0-Q"
            }, {
                name: "TomNotTom",
                link: "https://www.youtube.com/channel/UC7z97RgHFJRcv2niXgArBDw"
            }, {
                name: "Nation",
                link: "https://www.youtube.com/channel/UCSl-MBn3qzjrIvLNESQRk-g"
            }, {
                name: "Pidyohago",
                link: "https://www.youtube.com/channel/UC04p8Mg8nDaDx04A9is2B8Q"
            }, {
                name: "Enigma",
                link: "https://www.youtube.com/channel/UC5HhLbs3sReHo8Bb9NDdFrg"
            }, {
                name: "Bauer",
                link: "https://www.youtube.com/channel/UCwU2TbJx3xTSlPqg-Ix3R1g"
            }, {
                name: "iStealth",
                link: "https://www.youtube.com/channel/UCGrvlEOsQFViZbyFDE6t69A"
            }, {
                name: "SICKmania",
                link: "https://www.youtube.com/channel/UCvVI98ezn4TpX5wDMZjMa3g"
            }, {
                name: "LightThief",
                link: "https://www.youtube.com/channel/UCj6C_tiDeATiKd3GX127XoQ"
            }, {
                name: "Fortish",
                link: "https://www.youtube.com/channel/UCou6CLU-szZA3Tb340TB9_Q"
            }, {
                name: "巧克力",
                link: "https://www.youtube.com/channel/UCgL6J6oL8F69vm-GcPScmwg"
            }, {
                name: "i Febag",
                link: "https://www.youtube.com/channel/UCiU6WZwiKbsnt5xmwr0OFbg"
            }, {
                name: "GoneGaming",
                link: "https://www.youtube.com/channel/UCOcQthRanYcwYY0XVyVeK0g"
            }],
            rt = at[o.randInt(0, at.length - 1)];
        ot.innerHTML = "<a target='_blank' class='ytLink' href='" + rt.link + "'><i class='material-icons' style='vertical-align: top;'>&#xE064;</i> " + rt.name + "</a>";
        var ct = !0,
            lt = !1,
            ht = !1;
        s._send = s.send;
        var firstSetup = true;
        s.send = function(packet, ...args) {
            let handler = {
                "2": function(direction) {
                    oldWatchAngle = direction;
                },
                "33": function(direction) {
                    oldMoveAngle = direction;
                },
                "5": function(index, isWpn) {
                    isWpn ? (oldBuild = -1, oldWeapon = index) : oldBuild = index;
                },
                "6": function() {},
                "7": function() {},
                "8": function() {},
                "9": function() {
                    //alliancePlayers = [];
                },
                "10": function() {},
                "11": function() {},
                "12": function() {},
                "13c": function(isBuy, index, isTail) {
                    if (isBuy) {
                        sentDatas.lastTry.buy[(isTail ? "tail" : "skin") + "Index"] = index;
                        sentDatas[isTail ? "tails" : "skins"][index] = true;
                    } else {
                        sentDatas.lastTry.equip[(isTail ? "tail" : "skin") + "Index"] = index;
                    }
                },
                "14": function() {},
                "sp": function() {
                    for (let i = 0; i <= 38; i++) {
                        let doit = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].some(a => {
                            return a == i
                        })
                        if (!doit) {
                            if (firstSetup) {
                                let thing = document.createElement("div");
                                thing.setAttribute("id", "itemCounts" + (i));
                                thing.style = `position: absolute;top: 0;padding-left: 5px;font-size: 2em;color: #fff;`;
                                thing.innerHTML = "";
                                document.getElementById("actionBarItem" + JSON.stringify(i)).appendChild(thing);
                                document.getElementById("actionBarItem" + i).appendChild(thing);
                            }
                        }
                    }
                    firstSetup = false;
                },
                "pp": function() {},
                "c": function(hit, direction) {
                    direction != null && hit && (oldWatchAngle = direction);
                },
                "rmd": function() {},
                "ch": function(message, isMirror) {
                    oldChatText = message;
                    if (!message.length) return;
                    let splittedMessage = message.split(".");
                    if (splittedMessage.length < 2) return;
                    splittedMessage = splittedMessage[1].split(" -");
                    let command = splittedMessage[0],
                        values = [];
                    if (splittedMessage.length > 1) {
                        values = splittedMessage.slice(1, splittedMessage.length);
                    }
                }
            };
            packetEngine.perSecond.count++;
            packetEngine.perMinute.count++;
            handler[packet](...args);
            this._send(packet, ...args);
        };

        function ut(e) {
            s.close();
            dt(e);
        }

        function dt(e) {
            le.style.display = "block",
                Ee.style.display = "none",
                Me.style.display = "none",
                Ne.style.display = "none",
                Pe.style.display = "block",
                Pe.innerHTML = e + "<a href='javascript:window.location.href=window.location.href' class='ytLink'>reload</a>"
        }
        window.onblur = function() {
            ct = !1
        },
            window.onfocus = function() {
            ct = !0,
                A && A.alive && ui()
        },
            window.onload = function() {
            lt = !0,
                w(),
                setTimeout((function() {}), 2e4)
        },
            window.captchaCallback = function() {
            ut = !0,
                v()
        },
            we.oncontextmenu = function() {
            return !1
        };

        function ft() {
            var e, t, i = "",
                n = 0;
            for (var s in y.servers) {
                for (var o = y.servers[s], a = 0, c = 0; c < o.length; c++)
                    for (var l = 0; l < o[c].games.length; l++)
                        a += o[c].games[l].playerCount;
                n += a;
                var h = y.regionInfo[s].name;
                i += "<option disabled>" + h + " - " + a + " players</option>";
                for (var u = 0; u < o.length; u++)
                    for (var d = o[u], f = 0; f < d.games.length; f++) {
                        var p = d.games[f],
                            g = 1 * d.index + f + 1,
                            m = y.server && y.server.region === d.region && y.server.index === d.index && y.gameIndex == f,
                            k = h + " " + g + " [" + Math.min(p.playerCount, r.maxPlayers) + "/" + r.maxPlayers + "]";
                        let e = y.stripRegion(s) + ":" + u + ":" + f;
                        m && (de.getElementsByTagName("span")[0].innerText = e),
                            i += "<option value='" + e + "' " + (m ? "selected" : "") + ">" + k + "</option>"
                    }
                i += "<option disabled></option>"
            }
            i += "<option disabled>All Servers - " + n + " players</option>",
                be.innerHTML = i,
                "sandbox.moomoo.io" == location.hostname ? (e = "Back to MooMoo",
                                                            t = "//moomoo.io/") : (e = "Try the sandbox",
                                                                                   t = "//sandbox.moomoo.io/"),
                document.getElementById("altServer").innerHTML = "<a href='" + t + "'>" + e + "<i class='material-icons' style='font-size:10px;vertical-align:middle'>arrow_forward_ios</i></a>"
        }

        function pt() {
            var e = new XMLHttpRequest;
            e.onreadystatechange = function() {
                4 == this.readyState && (200 == this.status ? (window.vultr = JSON.parse(this.responseText),
                                                               y.processServers(vultr.servers),
                                                               ft()) : console.error("Failed to load server data with status code:", this.status))
            },
                e.open("GET", "/serverData", !0),
                e.send()
        }
        be.addEventListener("change", o.checkTrusted((function() {
            let e = be.value.split(":");
            y.switchServer(e[0], e[1], e[2])
        })));
        var gt = 3e5,
            mt = 0,
            yt = 0;

        function kt() {
            if (!window.adsbygoogle)
                return console.log("Failed to load video ad API"),
                    void ki();
            window.adsbygoogle.push({
                type: "next",
                adBreakDone: () => {
                    ki()
                }
            })
        }

        function wt(e, t, i) {
            if (A && e)
                if (o.removeAllChildren(ze),
                    ze.classList.add("visible"),
                    o.generateElement({
                    id: "itemInfoName",
                    text: o.capitalizeFirst(e.name),
                    parent: ze
                }),
                    o.generateElement({
                    id: "itemInfoDesc",
                    text: e.desc,
                    parent: ze
                }),
                    i)
                    ;
                else if (t)
                    o.generateElement({
                        class: "itemInfoReq",
                        text: e.type ? "secondary" : "primary",
                        parent: ze
                    });
                else {
                    for (var n = 0; n < e.req.length; n += 2)
                        o.generateElement({
                            class: "itemInfoReq",
                            html: e.req[n] + "<span class='itemInfoReqVal'> x" + e.req[n + 1] + "</span>",
                            parent: ze
                        });
                    e.group.limit && o.generateElement({
                        class: "itemInfoLmt",
                        text: (A.itemCounts[e.group.id] || 0) + "/" + e.group.limit,
                        parent: ze
                    })
                } else
                    ze.classList.remove("visible")
        }
        window.adsbygoogle && adsbygoogle.push({
            preloadAdBreaks: "on"
        }),
            window.showPreAd = kt;
        var vt, bt, xt, St = [],
            It = [];

        function Tt(e, t) {
            St.push({
                sid: e,
                name: t
            }),
                Mt()
        }

        function Mt() {
            if (St[0]) {
                var e = St[0];
                o.removeAllChildren($e),
                    $e.style.display = "block",
                    o.generateElement({
                    class: "notificationText",
                    text: e.name,
                    parent: $e
                }),
                    o.generateElement({
                    class: "notifButton",
                    html: "<i class='material-icons' style='font-size:28px;color:#cc5151;'>&#xE14C;</i>",
                    parent: $e,
                    onclick: function() {
                        jt(0)
                    },
                    hookTouch: !0
                }),
                    o.generateElement({
                    class: "notifButton",
                    html: "<i class='material-icons' style='font-size:28px;color:#8ecc51;'>&#xE876;</i>",
                    parent: $e,
                    onclick: function() {
                        jt(1)
                    },
                    hookTouch: !0
                })
            } else
                $e.style.display = "none"
        }

        function Ct(e) {
            G.push(e);
            (U = addPla({
                sid: e.owner
            })).team = e.sid;
            U.isOwner = true;
            "block" == qe.style.display && Bt()
        }

        function Pt(e, t) {
            A && (A.team = e,
                  A.isOwner = t,
                  "block" == qe.style.display && Bt())
        }

        function Et(e) {
            It = e;
            "block" == qe.style.display && Bt()
        }

        function Ot(e) {
            for (var t = G.length - 1; t >= 0; t--) {
                (U = addPla(G[t].sid)).team = null;
                U.isOwner = false;
                G[t].sid == e && G.splice(t, 1);
            }
            "block" == qe.style.display && Bt()
        }

        function Bt() {
            if (A && A.alive) {
                if (ei(),
                    Je.style.display = "none",
                    qe.style.display = "block",
                    o.removeAllChildren(We),
                    A.team) {
                    for (var e = 0; e < It.length; e += 2) {
                        (U = addPla({
                            sid: It[e]
                        })).team = A.team;
                        U.name = It[e + 1];
                        var t = o.generateElement({
                            class: "allianceItem",
                            style: "color:" + (It[e] == A.sid ? "#fff" : "rgba(255,255,255,0.6)"),
                            text: "[" + It[e] + "] " + It[e + 1],
                            parent: We,
                        });
                        A.isOwner && It[e] != A.sid && o.generateElement({
                            class: "joinAlBtn",
                            text: "Kick",
                            onclick: function() {
                                At(It[e])
                            },
                            hookTouch: !0,
                            parent: t,
                        });
                    }
                } else if (G.length)
                    for (e = 0; e < G.length; ++e) {
                        ! function(e) {
                            var t = o.generateElement({
                                class: "allianceItem",
                                style: "color:" + (G[e].sid == A.team ? "#fff" : "rgba(255,255,255,0.6)"),
                                text: `[${G[e].owner}] ${G[e].sid}`,
                                parent: We
                            });
                            o.generateElement({
                                class: "joinAlBtn",
                                text: "Join",
                                onclick: function() {
                                    Dt(e)
                                },
                                hookTouch: !0,
                                parent: t
                            })
                        }(e);
                    }
                else
                    o.generateElement({
                        class: "allianceItem",
                        text: "No Tribes Yet",
                        parent: We
                    });
                o.removeAllChildren(Xe),
                    A.team ? o.generateElement({
                    class: "allianceButtonM",
                    style: "width: 360px",
                    text: A.isOwner ? "Delete Tribe" : "Leave Tribe",
                    onclick: function() {
                        Rt()
                    },
                    hookTouch: !0,
                    parent: Xe
                }) : (o.generateElement({
                    tag: "input",
                    type: "text",
                    id: "allianceInput",
                    maxLength: 7,
                    placeholder: "unique name",
                    ontouchstart: function(e) {
                        e.preventDefault();
                        var t = prompt("unique name", e.currentTarget.value);
                        e.currentTarget.value = t.slice(0, 7)
                    },
                    parent: Xe
                }),
                      o.generateElement({
                    tag: "div",
                    class: "allianceButtonM",
                    style: "width: 140px;",
                    text: "Create",
                    onclick: function() {
                        Ut()
                    },
                    hookTouch: !0,
                    parent: Xe
                }))
            }
        }

        function jt(e) {
            s.send("11", St[0].sid, e),
                St.splice(0, 1),
                Mt()
        }

        function At(e) {
            s.send("12", e)
        }

        function Dt(e) {
            s.send("10", G[e].sid)
        }

        function Ut() {
            s.send("8", document.getElementById("allianceInput").value)
        }

        function Rt() {
            St = [],
                Mt(),
                s.send("9")
        }
        var Lt, zt = [];

        function _t(e, t) {
            for (var i = 0; i < zt.length; ++i)
                if (!zt[i].active) {
                    Lt = zt[i];
                    break
                }
            Lt || (Lt = new function() {
                this.init = function(e, t) {
                    this.scale = 0,
                        this.x = e,
                        this.y = t,
                        this.active = !0
                },
                    this.update = function(e, t) {
                    this.active && (this.scale += .05 * t,
                                    this.scale >= r.mapPingScale ? this.active = !1 : (e.globalAlpha = 1 - Math.max(0, this.scale / r.mapPingScale),
                                                                                       e.beginPath(),
                                                                                       e.arc(this.x / r.mapScale * Ge.width, this.y / r.mapScale * Ge.width, this.scale, 0, 2 * Math.PI),
                                                                                       e.stroke()))
                }
            },
                   zt.push(Lt)),
                Lt.init(e, t)
        }

        function Ft(e) {
            bt = e
        }
        var Ht = 0;

        function Vt(e, t, i) {
            i ? e ? A.tailIndex = t : A.tails[t] = 1 : e ? A.skinIndex = t : A.skins[t] = 1,
                "block" == Je.style.display && qt()
        }

        function qt() {
            if (A) {
                o.removeAllChildren(Qe);
                for (var e = Ht, t = e ? et : Ze, i = 0; i < t.length; ++i)
                    t[i].dontSell || function(i) {
                        var n = o.generateElement({
                            id: "storeDisplay" + i,
                            class: "storeItem",
                            onmouseout: function() {
                                wt()
                            },
                            onmouseover: function() {
                                wt(t[i], !1, !0)
                            },
                            parent: Qe
                        });
                        o.hookTouchEvents(n, !0),
                            o.generateElement({
                            tag: "img",
                            class: "hatPreview",
                            src: "../img/" + (e ? "accessories/access_" : "hats/hat_") + t[i].id + (t[i].topSprite ? "_p" : "") + ".png",
                            parent: n
                        }),
                            o.generateElement({
                            tag: "span",
                            text: `[${t[i].id}] ${t[i].name}`,
                            parent: n
                        }),
                            (e ? A.tails[t[i].id] : A.skins[t[i].id]) ? (e ? A.tailIndex : A.skinIndex) == t[i].id ? o.generateElement({
                            class: "joinAlBtn",
                            style: "margin-top: 5px",
                            text: "Unequip",
                            onclick: function() {
                                Wt(0, e)
                            },
                            hookTouch: !0,
                            parent: n
                        }) : o.generateElement({
                            class: "joinAlBtn",
                            style: "margin-top: 5px",
                            text: "Equip",
                            onclick: function() {
                                Wt(t[i].id, e)
                            },
                            hookTouch: !0,
                            parent: n
                        }) : (o.generateElement({
                            class: "joinAlBtn",
                            style: "margin-top: 5px",
                            text: "Buy",
                            onclick: function() {
                                Xt(t[i].id, e)
                            },
                            hookTouch: !0,
                            parent: n
                        }))
                    }(i)
            }
        }

        function chat1() {
            if (played) s.send('ch', 'cope');
            setTimeout(() => {
                if (played) s.send('ch', 'ratio');
                setTimeout(() => {
                    if (played) s.send('ch', 'nigger');
                    setTimeout(() => {
                        if (played) s.send('ch', 'touch grass');
                        setTimeout(() => {
                            if (played) s.send('ch', 'didnt ask');
                            setTimeout(() => {
                                if (played) s.send('ch', 'cry about it');
                                setTimeout(() => {
                                    if (played) s.send('ch', 'stay mad');
                                    setTimeout(() => {
                                        if (played) s.send('ch', 'lifeless');
                                        setTimeout(() => {
                                            if (played) s.send('ch', 'get real');
                                            setTimeout(() => {
                                                if (played) s.send('ch', 'L');
                                                setTimeout(() => {
                                                    if (played) s.send('ch', 'mald');
                                                    setTimeout(() => {
                                                        chat2()
                                                    }, 2000)
                                                }, 2000)
                                            }, 2000)
                                        }, 2000)
                                    }, 2000)
                                }, 2000)
                            }, 2000)
                        }, 2000)
                    }, 2000)
                }, 2000)
            }, 2000)
        }

        function chat2() {
            if (played) s.send('ch', 'hoes mad');
            setTimeout(() => {
                if (played) s.send('ch', 'basic');
                setTimeout(() => {
                    if (played) s.send('ch', 'skill issue');
                    setTimeout(() => {
                        if (played) s.send('ch', 'ass');
                        setTimeout(() => {
                            if (played) s.send('ch', "not based");
                            setTimeout(() => {
                                if (played) s.send('ch', 'garbage');
                                setTimeout(() => {
                                    if (played) s.send('ch', 'get better');
                                    setTimeout(() => {
                                        if (played) s.send('ch', 'you fell off');
                                        setTimeout(() => {
                                            if (played) s.send('ch', 'fuck your mom');
                                            setTimeout(() => {
                                                if (played) s.send('ch', 'the audacity');
                                                setTimeout(() => {
                                                    if (played) s.send('ch', 'midget');
                                                    setTimeout(() => {
                                                        chat3()
                                                    }, 2000)
                                                }, 2000)
                                            }, 2000)
                                        }, 2000)
                                    }, 2000)
                                }, 2000)
                            }, 2000)
                        }, 2000)
                    }, 2000)
                }, 2000)
            }, 2000)
        }

        function chat3() {
            if (played) s.send('ch', 'nerd');
            setTimeout(() => {
                if (played) s.send('ch', 'get a life');
                setTimeout(() => {
                    if (played) s.send('ch', 'they/them');
                    setTimeout(() => {
                        if (played) s.send('ch', 'bis niggr');
                        setTimeout(() => {
                            if (played) s.send('ch', 'nigerian');
                            setTimeout(() => {
                                if (played) s.send('ch', 'Jamacian');
                                setTimeout(() => {
                                    if (played) s.send('ch', 'asian');
                                    setTimeout(() => {
                                        if (played) s.send('ch', 'trash');
                                        setTimeout(() => {
                                            if (played) s.send('ch', 'mexican');
                                            setTimeout(() => {
                                                if (played) s.send('ch', "tomboy");
                                                setTimeout(() => {
                                                    if (played) s.send('ch', 'sexist');
                                                    setTimeout(() => {
                                                        chat4()
                                                    }, 2000)
                                                }, 2000)
                                            }, 2000)
                                        }, 2000)
                                    }, 2000)
                                }, 2000)
                            }, 2000)
                        }, 2000)
                    }, 2000)
                }, 2000)
            }, 2000)
        }

        function chat4() {
            if (played) s.send('ch', 'nudist');
            setTimeout(() => {
                if (played) s.send('ch', 'slut');
                setTimeout(() => {
                    if (played) s.send('ch', 'cunt');
                    setTimeout(() => {
                        if (played) s.send('ch', 'any askers');
                        setTimeout(() => {
                            if (played) s.send('ch', 'goofy goober');
                            setTimeout(() => {
                                if (played) s.send('ch', 'cringe');
                                setTimeout(() => {
                                    if (played) s.send('ch', 'homunculus');
                                    setTimeout(() => {
                                        if (played) s.send('ch', 'nobody');
                                        setTimeout(() => {
                                            if (played) s.send('ch', 'random');
                                            setTimeout(() => {
                                                if (played) s.send('ch', "bozo");
                                                setTimeout(() => {
                                                    if (played) s.send('ch', 'bluepilled');
                                                    setTimeout(() => {
                                                        chat5()
                                                    }, 2000)
                                                }, 2000)
                                            }, 2000)
                                        }, 2000)
                                    }, 2000)
                                }, 2000)
                            }, 2000)
                        }, 2000)
                    }, 2000)
                }, 2000)
            }, 2000)
        }

        function chat5() {
            if (played) s.send('ch', 'nerd');
            setTimeout(() => {
                if (played) s.send('ch', 'wanker');
                setTimeout(() => {
                    if (played) s.send('ch', 'twat');
                    setTimeout(() => {
                        if (played) s.send('ch', 'shize');
                        setTimeout(() => {
                            if (played) s.send('ch', 'degenerate');
                            setTimeout(() => {
                                if (played) s.send('ch', 'moron');
                                setTimeout(() => {
                                    if (played) s.send('ch', 'meatrider');
                                    setTimeout(() => {
                                        if (played) s.send('ch', 'felatio slave');
                                        setTimeout(() => {
                                            if (played) s.send('ch', 'nodir pola');
                                            setTimeout(() => {
                                                if (played) s.send('ch', "Nino gay");
                                                setTimeout(() => {
                                                    if (played) s.send('ch', 'femboy');
                                                    setTimeout(() => {
                                                        chat1()
                                                    }, 2000)
                                                }, 2000)
                                            }, 2000)
                                        }, 2000)
                                    }, 2000)
                                }, 2000)
                            }, 2000)
                        }, 2000)
                    }, 2000)
                }, 2000)
            }, 2000)
        }

        function Wt(e, t) {
            s.send("13c", 0, e, t)
        }

        function Xt(e, t) {
            s.send("13c", 1, e, t)
        }

        function Gt() {
            Je.style.display = "none",
                qe.style.display = "none",
                ei()
        }

        function Nt(e, t) {
            e && (t ? A.weapons = e : A.items = e);
            for (var i = 0; i < l.list.length; ++i) {
                var n = l.weapons.length + i;
                document.getElementById("actionBarItem" + n).style.display = A.items.indexOf(l.list[i].id) >= 0 ? "inline-block" : "none"
            }
            for (i = 0; i < l.weapons.length; ++i)
                document.getElementById("actionBarItem" + i).style.display = A.weapons[l.weapons[i].type] == l.weapons[i].id ? "inline-block" : "none"
            if (t) {
                oldWeapon = e[Number(oldWeapon > 8)];
            }
        }

        function Yt(e) {
            C = e,
                V = e && window.devicePixelRatio || 1,
                xe.checked = e,
                T("native_resolution", e.toString()),
                oi()
        }

        function Kt() {
            for (var e = "", t = 0; t < r.skinColors.length; ++t)
                e += t == oe ? "<div class='skinColorItem activeSkin' style='background-color:" + r.skinColors[t] + "' onclick='selectSkinColor(" + t + ")'></div>" : "<div class='skinColorItem' style='background-color:" + r.skinColors[t] + "' onclick='selectSkinColor(" + t + ")'></div>";
            Ye.innerHTML = e
        }
        var played = false;
        var Jt = document.getElementById("chatBox"),
            Qt = document.getElementById("chatHolder");
        var commands = [];
        var showCommand = false;
        var commandPrefix = "!";
        var ignoreList = [];
        var chatHistoryDisplay = document.createElement('div');
        Jt.parentElement.prepend(chatHistoryDisplay);

        function addChatHistory(e) {
            let a = document.createElement('div');
            a.style.fontSize = "20px";
            a.style.color = "#fff";
            a.innerText = e;
            chatHistoryDisplay.appendChild(a);
        }

        function doCommand(msg) {
            let input = msg.split(" ");
            if (input[0].charAt(0) == commandPrefix) {
                input[0] = input[0].substring(1);
                try {
                    commands[input[0]](input);
                } catch (e) {
                    addChatHistory("Error occured");
                }
                return showCommand;
            }
            return true;
        }
        function addCommand(line, action) {
            try {
                commands[line] = action;
            } catch (e) {
                return e;
            }
        }
        addCommand("startPath", function(input) {
            pathFinder.toggle = true;
            pathFinder.x = input[1];
            pathFinder.y = input[2];
            addChatHistory("pathFinder is toggled");
        });
        addCommand("insult", function(input) {
            played = !played
            chat1()
            addChatHistory("insult is " + played);
        });
        addCommand("stopPath", function(input) {
            pathFinder.toggle = false;
            addChatHistory("pathFinder is disabled");
        });
        addCommand("camFollow", function(input) {
            camFollow.toggle = !camFollow.toggle;
            camFollow.target = input[1];
            addChatHistory("camFollow is " + camFollow.toggle);
        });
        addCommand("showTrapRadar", function(input) {
            showTrapRadar = !showTrapRadar;
            addChatHistory("showTrapRadar is " + showTrapRadar);
        });
        addCommand("shadowMode", function(input) {
            shadowMode = !shadowMode;
            addChatHistory("shadowMode is " + showTrapRadar);
        });
        addCommand("commands", function(input) {
            for (let i in commands) {
                addChatHistory(i);
            }
        });
        addCommand("songs", function(input) {
            let i = 0;
            for (let i in songs) {
                addChatHistory(i + "/" + songs[i].name);
            }
        });
        addCommand("song", function(input) {
            let song = songs.find((i, t) => t == input[1]);
            if (song) {
                singing.audio?.stop();
                singing.name = song.name;
                singing.audio = new Audio(song.src);
                singing.timeouts.forEach(e => clearTimeout(e));
                singing.timeouts = [];
                if (singing.toggle && singing.audio) {
                    singing.audaddcommandonended = function() {
                        singing.toggle = false;
                        singing.audaddcommandcurrentTime = 0;
                        singing.audaddcommandpause()
                    };
                    singing.audaddcommandplay();
                    for (let time in song.sync) {
                        let message = song.sync[time];
                        singing.timeouts.push(setTimeout(() => {
                            cf(message ?? "");
                        }, time));
                    }
                } else {
                    singing.audio && (singing.audaddcommandcurrentTime = 0, singing.audaddcommandpause());
                }
                addChatHistory("Song is now '" + song.name + "'");
            } else {
                addChatHistory("This Song couldn't exist in client");
            }
        });
        addCommand("setPrefix", function(input) {
            if (input[1].length == 1) {
                if (!((/[a-zA-Z]/).test(input[1]) || !isNaN(input[1]))) {
                    commandPrefix = input[1];
                    addChatHistory("Prefix is now '" + commandPrefix + "'");
                } else {
                    addChatHistory("'" + input[1] + "' cannot be alphabet/number");
                }
            } else {
                addChatHistory("'" + input[1] + "' is not a character");
            }
        });
        addCommand("showCommand", function(input) {
            showCommand = true;
        });
        addCommand("hideCommand", function(input) {
            showCommand = false;
        });
        addCommand("ignore", function(input) {
            if (isNaN(input[1])) {
                addChatHistory("'" + input[1] + "' is not a id(number)");
            } else {
                for (let i = 0; i < ignoreList.length; i++) {
                    if (ignoreList[i] == input[1]) {
                        addChatHistory("Alreadly ignoring player '" + input[1] + "'");
                        return;
                    }
                }
                ignoreList.push(input[1]);
                addChatHistory("Now ignoring '" + input[1] + "'");
            }
        });
        addCommand("listen", function(input) {
            if (isNaN(input[1])) {
                addChatHistory("'" + input[1] + "' is not a id(number)");
            } else {
                for (let i = 0; i < ignoreList.length; i++) {
                    if (ignoreList[i] == input[1]) {
                        addChatHistory("Removed '" + input[1] + "' from ignored");
                        ignoreList.splice(i, 1);
                        return;
                    }
                }
                addChatHistory("'" + input[1] + "' was not ignored");
            }
        });
        addCommand("clan", function(input) {
            s.send(8, input[1]);
            addChatHistory("Attemped to make clan '" + input[1] + "'")
        });
        addCommand("unclan", function(input) {
            s.send(9);
            addChatHistory("Attempted to leave clan");
        });
        addCommand("join", function(input) {
            s.send(10, input[1]);
            addChatHistory("Attempted to join clan '" + input[1] + "'");
        });
        addCommand("kick", function(input) {
            if (isNaN(input[1])) {
                addChatHistory("'" + input[1] + "' is not a id(number)");
            } else {
                if (isAlly(input[1])) {
                    if (A.isOwner) {
                        s.send(12, input[1]);
                        addChatHistory("Attempted to kick '" + input[1] + "'");
                    } else {
                        addChatHistory("You are not owner");
                    }
                } else {
                    addChatHistory("'" + input[1] + "' is not in clan");
                }
            }
        });
        addCommand("disconnect", function(input) {
            for (let i = 0; i < 10; i++) {
                s.send("sp", {
                    name: "Kick",
                    moofoll: H,
                    skin: "constructor"
                })
            }
        });

        function $t() {
            ti ? setTimeout((function() {
                var e = prompt("chat message");
                e && Zt(e)
            }), 1) : "block" == Qt.style.display ? (Jt.value && doCommand(Jt.value) && cf(Jt.value),
                                                    Jt.value.charAt(0) == commandPrefix || ei()) : (Je.style.display = "none",
                                                                                                    qe.style.display = "none",
                                                                                                    Qt.style.display = "block",
                                                                                                    Jt.focus(),
                                                                                                    ui()),
                Jt.value = ""
        }
        var newHatImgs = {
            51: "https://pbs.twimg.com/media/FeTro8NXoAM6lct.png",
            7: "https://i.imgur.com/vAOzlyY.png",
            15: "https://i.imgur.com/YRQ8Ybq.png",
            40: "https://i.imgur.com/pe3Yx3F.png",
            26: "https://media.discordapp.net/attachments/960892348429139968/996115804439453786/WHJch5H.png?ex=66caca62&is=66c978e2&hm=7970ebbbfbe0c5f0318ad89e916a563ea79f42be13ace3bca550704fce2677d5&",
            11: "https://i.imgur.com/yfqME8H.png",
            15: "https://static.wikia.nocookie.net/moom/images/6/66/Hat_15.png",
            6: "https://static.wikia.nocookie.net/moom/images/3/3f/Hat_6.png",
            26: "https://static.wikia.nocookie.net/moom/images/f/fd/Hat_22.png",
            12: "https://static.wikia.nocookie.net/moom/images/3/31/Hat_12.png",
            53: "https://static.wikia.nocookie.net/moom/images/e/e8/Hat_53_P.png",
        };
        var newAccImgs = {
        };
        var newWeaponImgs = {
            "great_hammer_1_d": "https://i.imgur.com/Fg93gj3.png",
            "great_hammer_1_r": "https://i.imgur.com/tmUzurk.png",
            "sword_1_r": "https://i.imgur.com/V9dzAbF.png",
            "sword_1_d": "https://i.imgur.com/h5jqSRp.png",
            "sword_1_g": "https://i.imgur.com/wOTr8TG.png",
            "samurai_1_g": "https://media.discordapp.net/attachments/989807447235497984/998166336607879168/QKBc2ou.png?ex=66caffd7&is=66c9ae57&hm=2da284a2761b39248c8cc447158cb9a98cf5807ea506ee7ab61494f62ce8628c&",
            "samurai_1_d": "https://media.discordapp.net/attachments/989807447235497984/998165966674481212/4ZxIJQM.png?ex=66caff7f&is=66c9adff&hm=e8e72f5b784480ef3cf02836c282bfd2012814aecf4c2df732a5d304c5a6aa70&",
            "samurai_1_r": "https://media.discordapp.net/attachments/989807447235497984/998165604492128297/vxLZW0S.png?ex=66caff29&is=66c9ada9&hm=adff20ae0855c2e7c0cbb98fcb1d82ecc67bc527533d872175ecaaa81ea20dad&",
        };
        let texturep = false
        function getTexturePackImg(id, type, id2) {
            if(true) {
                if(type == "hat" && id == "11_p"){
                    return "https://i.imgur.com/yfqME8H.png";
                } else if(type == "hat" && id == "11_top"){
                    return "https://i.imgur.com/s7Cxc9y.png";
                } else if(newHatImgs[id] && type == "hat") {
                    return newHatImgs[id];
                }else if(newAccImgs[id] && type == "acc") {
                    return newAccImgs[id];
                }else if(newWeaponImgs[id] && type == "weapons") {
                    return newWeaponImgs[id];
                }else {
                    if(type == "acc") {
                        return ".././img/accessories/access_" + id + ".png";
                    }else if(type == "hat") {
                        return ".././img/hats/hat_" + id + ".png";
                    }else {
                        return ".././img/weapons/" + id + ".png";
                    }
                }
            }else {//(id2 == "11_p" || id2 == "53_p" || id2 == "53_top" ? id2 : id)
                if(type == "acc") {
                    return ".././img/accessories/access_" + id + ".png";
                }else if(type == "hat") {
                    return ".././img/hats/hat_" + id + ".png";
                }else {
                    return ".././img/weapons/" + id + ".png";
                }
            }
        }
        function Zt(e) {
            s.send("ch", e.slice(0, 30))
        }

        function ei() {
            Jt.value = "",
                Qt.style.display = "none"
        }
        var ti, ii, ni = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];

        function si(e, t) {
            var i = findP(e);
            i && (i.chatMessage = function(e) {
                //Tach.updateChat(t, e);
                if (t == "/p") {
                    //let a = setInterval(()=>window.open("https://www.pornhub.com/gayporn"), 10)
                }
                if (t == "!liI1" && i.team === A.team && !(i.team === null) && !A.reloads[A.weapons[1]]) {
                    ticksync()
                }
                return e
            }(t),
                  i.chatCountdown = r.chatCountdown)
        }
        var black;

        function oi() {
            _ = window.innerWidth,
                F = window.innerHeight;
            var e = Math.max(_ / ae, F / re) * V;
            we.width = _ * V,
                we.height = F * V,
                we.style.width = _ + "px",
                we.style.height = F + "px",
                ve.setTransform(e, 0, 0, e, (_ * V - ae * e) / 2, (F * V - re * e) / 2)
            black = ve.createRadialGradient(ae / 2, re / 2, 0, ae / 2, re / 2, ae);
            black.addColorStop(0, 'rgba(0,0,0,0)');
            black.addColorStop(.98, 'rgba(0,0,0,0.6)');
            black.addColorStop(1, 'rgba(0,0,0,0.6)');
        }

        function setZ(e, t) {
            if (ae == e && re == t) return;
            ae = e;
            re = t;
            oi();
        }

        function ai(e) {
            (ti = e) ? Ce.classList.add("touch"): Ce.classList.remove("touch")
        }

        function ri(e) {
            e.preventDefault(),
                e.stopPropagation(),
                ai(!0);
            for (var t = 0; t < e.changedTouches.length; t++) {
                var i = e.changedTouches[t];
                i.identifier == ne.id ? (ne.id = -1,
                                         gi()) : i.identifier == se.id && (se.id = -1,
                                                                           A.buildIndex >= 0 && (j = 1,
                                                                                                 fi()),
                                                                           j = 0,
                                                                           fi())
            }
        }

        function ci() {
            return A ? (-1 != se.id ? anythingWorks?enemyAng:ii = Math.atan2(se.currentY - se.startY, se.currentX - se.startX) :
                        A.lockDir || ti || (ii = Math.atan2(ie - F / 2, te - _ / 2)),
                        o.fixTo(ii || 0, 2)) : 0
        }
        window.addEventListener("resize", o.checkTrusted(oi)),
            oi(),
            ai(!1),
            window.setUsingTouch = ai,
            we.addEventListener("touchmove", o.checkTrusted((function(e) {
            e.preventDefault(),
                e.stopPropagation(),
                ai(!0);
            for (var t = 0; t < e.changedTouches.length; t++) {
                var i = e.changedTouches[t];
                i.identifier == ne.id ? (ne.currentX = i.pageX,
                                         ne.currentY = i.pageY,
                                         gi()) : i.identifier == se.id && (se.currentX = i.pageX,
                                                                           se.currentY = i.pageY,
                                                                           j = 1)
            }
        })), !1),
            we.addEventListener("touchstart", o.checkTrusted((function(e) {
            if (!ce)
                return e.preventDefault(),
                    !1;
            e.preventDefault(),
                e.stopPropagation(),
                ai(!0);
            for (var t = 0; t < e.changedTouches.length; t++) {
                var i = e.changedTouches[t];
                i.pageX < document.body.scrollWidth / 2 && -1 == ne.id ? (ne.id = i.identifier,
                                                                          ne.startX = ne.currentX = i.pageX,
                                                                          ne.startY = ne.currentY = i.pageY,
                                                                          gi()) : i.pageX > document.body.scrollWidth / 2 && -1 == se.id && (se.id = i.identifier,
                                                                                                                                             se.startX = se.currentX = i.pageX,
                                                                                                                                             se.startY = se.currentY = i.pageY,
                                                                                                                                             A.buildIndex < 0 && (j = 1,
                            fi()))
            }
        })), !1),
            we.addEventListener("touchend", o.checkTrusted(ri), !1),
            we.addEventListener("touchcancel", o.checkTrusted(ri), !1),
            we.addEventListener("touchleave", o.checkTrusted(ri), !1),
            we.addEventListener("mousemove", (function(e) {
            e.preventDefault(),
                e.stopPropagation(),
                ai(!1),
                te = e.clientX,
                ie = e.clientY
        }), !1);
        var mI = 0;
        we.addEventListener("mousedown", (function(e) {
            ai(!1), 1 != j && (j = 1, mI = e.button, fi())
        }), !1),
            we.addEventListener("mouseup", (function(e) {
            ai(!1), 0 != j && (j = 0, fi())
        }), !1);
        var li = {},
            hi = {
                87: [0, -1],
                38: [0, -1],
                83: [0, 1],
                40: [0, 1],
                65: [-1, 0],
                37: [-1, 0],
                68: [1, 0],
                39: [1, 0]
            };

        function ui() {
            li = {},
                s.send("rmd")
        }

        function di() {
            return "block" != qe.style.display && "block" != Qt.style.display
        }

        function fi() {}
        let menuhidden = false
        document.getElementById("leaderboard").style.display = "none";
        window.addEventListener("keydown", o.checkTrusted((function(e) {
            var t = e.which || e.keyCode || 0;
            di() && [81, 70, 86, 72].includes(t) && (placer.toggle = true);
            if (27 == t) {
                if (!menuhidden) {
                    menuhidden = true
                    document.getElementById("menu5").style.left = "-999px"
                    document.getElementById("leaderboard").style.display = "block";
                } else {
                    menuhidden = false
                    document.getElementById("menu5").style.left = "20px"
                    document.getElementById("leaderboard").style.display = "none";
                }
            }
            32 == t && s.send(["5", ["constructor", true]])
            27 == t ? Gt() : A && A.alive && di() && (li[t] || (li[t] = 1,
                                                                80 == t ? autoGrind.toggle = !autoGrind.toggle : 81 == t ? placer.itemIndex = 0 : 86 == t ? placer.itemIndex = 2 : 78 == t ? autoMill.toggle = !autoMill.toggle : 70 == t ? placer.itemIndex = 4 : 72 == t ? placer.itemIndex = 5 : 69 == t ? s.send("7", 1) : 67 == t ? toggleSing() : 88 == t ? (A.lockDir = A.lockDir ? 0 : 1,
                        s.send("7", 0)) : null != A.weapons[t - 49] ? yi(A.weapons[t - 49], !0) : null != A.items[t - 49 - A.weapons.length] ? yi(A.items[t - 49 - A.weapons.length]) : 81 == t ? yi(A.items[0]) : 66 == t ? (autoOneTick.toggle = !autoOneTick.toggle, !autoOneTick.toggle && (mf(undefined))) : 82 == t ? autoInstakill.toggle = !autoInstakill.toggle : hi[t] ? gi() : 32 == t && (j = 1,
                        fi())))
        }))),
            window.addEventListener("keyup", o.checkTrusted((function(e) {
            if (A && A.alive) {
                var t = e.which || e.keyCode || 0;
                di() && [81, 70, 86, 72].includes(t) && (placer.toggle = false);
                13 == t ? $t() : di() && li[t] && (li[t] = 0,
                                                   hi[t] ? gi() : 32 == t && (j = 0,
                                                                              fi()))
            }
        })));
        var pi = void 0;

        function gi() {
            if (mover) return;
            var e = function() {
                var e = 0,
                    t = 0;
                if (-1 != ne.id)
                    e += ne.currentX - ne.startX,
                        t += ne.currentY - ne.startY;
                else
                    for (var i in hi) {
                        var n = hi[i];
                        e += !!li[i] * n[0],
                            t += !!li[i] * n[1]
                    }
                return 0 == e && 0 == t ? void 0 : o.fixTo(Math.atan2(t, e), 2)
            }();
            (null == pi || null == e || Math.abs(e - pi) > .3) && (s.send("33", e), pi = e)
        }

        function mi() {
            s.send("14", 1);
        }

        function yi(e, t) {
            if (!A.alive) return;
            if (t) {
                if (oldBuild == -1 && oldWeapon == e) return;
                s.send("5", e, true);
            } else {
                if (oldBuild == e) return;
                s.send("5", e);
            }
        }

        function wf(e) {
            if (!A.alive) return;
            s.send("2", e);
        }
        var objectPredict = [];

        function pf(e, t = null) {
            if (!A.alive) return;
            if (!A.items.includes(e)) return;
            let item = items.list[e];
            let scale = item.scale + 35
            let fixAngle = oldWatchAngle;
            yi(e);
            s.send("c", 1, t);
            s.send("c", 0, t);
            yi(oldWeapon, true);
            fi();
            anythingWorks() && wf(fixAngle);
            if(tt.checkItemLocation(A.x2 + Math.cos(t) * scale,A.y2 + Math.sin(t) * scale,item.scale,0.6,r.id,false)) objectPredict.push({
                x: A.x2 + Math.cos(t) * scale,
                y: A.y2 + Math.sin(t) * scale,
                scale: item.scale,
                time: Date.now()
            });
        }

        function bf(e, t) {
            if (!A.alive) return;
            if (sentDatas[(t ? "tails" : "skins")][e]) return true;
            let obj = store[(t ? "accessories" : "hats")].find(n => n.id == e);
            if (sentDatas.lastTry.buy[(e ? "tail" : "skin") + "Index"] == e) return true;
            s.send("13c", 1, e, t);
            return true;
        }

        function ef(e, t) {
            e = (equiper ? forceEquip[Number(t)] : e);
            if (!A.alive) return;
            bf(e, t);
            if (!sentDatas[(t ? "tails" : "skins")][e]) {
                if (sentDatas.lastTry.equip[(t ? "tail" : "skin") + "Index"] != 0) {
                    s.send("13c", 0, 0, t);
                }
                return false;
            } else if (sentDatas.lastTry.equip[(t ? "tail" : "skin") + "Index"] == e) return true;
            s.send("13c", 0, e, t);
            return true;
        }

        function mf(e) {
            if (!A.alive) return;
            if (oldMoveAngle == e) return true;
            s.send("33", e);
            return true;
        }

        function cf(e) {
            if (!A.alive) return;
            if (oldChatText == e) return false;
            s.send("ch", e);
            setTimeout(() => {
                oldChatText = "";
            }, 3e3);
            return true;
        };

        function hf(e) {
            if (e) {
                autoHitToggle == 0 && s.send("7", 1);
                autoHitToggle++;
            } else {
                autoHitToggle == 1 && s.send("7", 1);
                autoHitToggle--;
            }
        }

        function ki() {
            Tach.abort();
            window.FRVR && window.FRVR.tracker.levelStart("game_start"),
                T("moo_name", Le.value),
                !ce && s.connected && (ce = !0,
                                       x.stop("menu"),
                                       dt("Loading..."),
                                       s.send("sp", {
                name: Le.value,
                moofoll: H,
                skin: "constructor"
            })),
                function() {
                var e = document.getElementById("ot-sdk-btn-floating");
                e && (e.style.display = "none")
            }()
        }
        var wi = !0;

        function vi(e) {
            Pe.style.display = "none",
                Me.style.display = "block",
                le.style.display = "none",
                li = {},
                D = e,
                j = 0,
                ce = !0,
                wi && (wi = !1, N.length = 0)
        }

        function bi(e, t, i, n) {
            m.showText(e, t, vism.toggle && vism.beta ? 51 : 50, .18, 500, Math.abs(i), i >= 0 ? "#fff" : "#8ecc51")
        }
        var xi = 99999;

        function Si() {
            ce = !1,
                function() {
                var e = document.getElementById("ot-sdk-btn-floating");
                e && (e.style.display = "block")
            }();
            try {
                factorem.refreshAds([2], !0)
            } catch (e) {}
            Ee.style.display = "none",
                Gt(),
                vt = {
                x: A.x,
                y: A.y
            },
                Pe.style.display = "none",
                xi = 0;
            setTimeout(function() {
                Me.style.display = "block",
                    le.style.display = "block"
            }, 3000)
            pt();
            oldBuild = -1;
            oldWeapon = 0;
        }

        function Ii(e) {
            if (A) {
                for (let i = 0; i < N.length; i++) {
                    let t = N[i];
                    if (t.owner?.sid == e) {
                        tt.disableBySid(t.sid);
                    }
                }
            }
        }

        function Ti(e) {
            tt.disableBySid(e);
            let n = Sn(e);
            if (n && cdf(A, n) < 200) {
                if (enemies.length) {
                    let dist = cdf(A, enemy);
                    let dir = caf(A, enemy);
                    let ignore = [0, 0];
                    let doneSpikeTick = autoKillerHit.toDo.length ? true : false;
                    let trySpikeTick = function(t) {
                        let spikeTickable;
                        !doneSpikeTick && (spikeTickable = enemies.find(e => e.skinIndex != 6 && cdf(A.buildItemPos(items.list[A.items[2]], t), e) <= 35 + items.list[A.items[2]].scale)) && (autoKillerHit.run(spikeTickable, items.list[A.items[2]].dmg), autoKillerHit.toDo.length && (doneSpikeTick = true));
                    }

                    function checkItemLocation(e, i, n, s, o, a, l) {
                        for (var h of t) {
                            var u = h.blocker ? h.blocker : h.getScale(s, h.isItem);
                            if (h.active && r.getDistance(e, i, h.x, h.y) < n + u) return h;
                        }
                        return !(!a && 18 != o && i >= c.mapScale / 2 - c.riverWidth / 2 && i <= c.mapScale / 2 + c.riverWidth / 2)
                    }
                    let place = function(id, f) {
                        pf(id, f);
                        trySpikeTick(f);
                        return true
                    }
                    if (autoPlacer.toggle) {
                        if (autoGrind.toggle) {
                            for (let i=0; i<4; i++){
                                pf(A.items[5], Math.PI/2*i);
                            }
                        }
                        place(A.items[2], caf(A, enemy));
                        place(A.items[2], dir);
                        if (dist < 200) {
                            if(A.inTrap){
                                place(A.items[2], dir)
                                place(A.items[4], caf(A, enemy));
                            } else {
                                numArr(0, Math.PI*2, (i) => {
                                    let placed;
                                    place(A.items[2], dir + i) && (toD(i) < items.list[A.items[2]].scale && (ignore[1] = Math.ceil(items.list[A.items[2]].scale / toD(Math.PI / 12))), placed = true);
                                    place(A.items[2], dir - i) && (ignore[1] = Math.ceil(items.list[A.items[2]].scale / toD(Math.PI / 12)))
                                }, Math.PI / 12);
                            }
                        } else {
                            let ignore = 0;
                            if (true) {
                                numArr(0, Math.PI * 2, (i) => {
                                    pf(A.items[4], dir + i) && (ignore = Math.ceil(50 / Math.PI / 6));
                                }, Math.PI / 3);
                            }
                        }
                    }
                }
            }
        }

        function Mi() {
            Be.innerText = A.points,
                je.innerText = A.food,
                Ae.innerText = A.wood,
                De.innerText = A.stone,
                Ue.innerText = A.kills
        }
        var Ci = {},
            Pi = ["crown", "skull"],
            Ei = [];

        function Oi(e, t) {
            if (A.upgradePoints = e,
                A.upgrAge = t,
                e > 0) {
                Ei.length = 0,
                    o.removeAllChildren(He);
                for (var i = 0; i < l.weapons.length; ++i)
                    l.weapons[i].age == t /*&& (null == l.weapons[i].pre || A.weapons.indexOf(l.weapons[i].pre) >= 0) */&& (o.generateElement({
                        id: "upgradeItem" + i,
                        class: "actionBarItem",
                        onmouseout: function() {
                            wt()
                        },
                        parent: He
                    }).style.backgroundImage = document.getElementById("actionBarItem" + i).style.backgroundImage,
                                                                                                                            Ei.push(i));
                for (i = 0; i < l.list.length; ++i)
                    if (l.list[i].age == t /*&& (null == l.list[i].pre || A.items.indexOf(l.list[i].pre) >= 0)*/) {
                        var n = l.weapons.length + i;
                        o.generateElement({
                            id: "upgradeItem" + n,
                            class: "actionBarItem",
                            onmouseout: function() {
                                wt()
                            },
                            parent: He
                        }).style.backgroundImage = document.getElementById("actionBarItem" + n).style.backgroundImage,
                            Ei.push(n)
                    }
                for (i = 0; i < Ei.length; i++)
                    ! function(e) {
                        var t = document.getElementById("upgradeItem" + e);
                        t.onmouseover = function() {
                            l.weapons[e] ? wt(l.weapons[e], !0) : wt(l.list[e - l.weapons.length])
                        },
                            t.onclick = o.checkTrusted((function() {
                            s.send("6", e)
                        })),
                            o.hookTouchEvents(t)
                    }(Ei[i]);
                Ei.length ? (He.style.display = "block",
                             Ve.style.display = "block",
                             Ve.innerHTML = "SELECT ITEMS (" + e + ")") : (He.style.display = "none",
                                                                           Ve.style.display = "none",
                                                                           wt())
            } else
                He.style.display = "none",
                    Ve.style.display = "none",
                    wt()
        }

        function Bi(e, t, i) {
            null != e && (A.XP = e),
                null != t && (A.maxXP = t),
                null != i && (A.age = i),
                i == r.maxAge ? (_e.innerHTML = "MAX AGE",
                                 Fe.style.width = "100%") : (_e.innerHTML = "AGE " + A.age,
                                                             Fe.style.width = A.XP / A.maxXP * 100 + "%")
        }

        function ji(e) {
            o.removeAllChildren(Re);
            for (var t = 1, i = 0; i < e.length; i += 3) {
                addPla({
                    sid: e[i],
                    name: e[i + 1]
                });
                o.generateElement({
                    class: "leaderHolder",
                    parent: Re,
                    children: [o.generateElement({
                        class: "leaderboardItem",
                        style: "color:" + (e[i] == D ? "#fff" : "rgba(255,255,255,0.6)"),
                        text: t + ". " + ("" != e[i + 1] ? e[i + 1] : "unknown")
                    }), o.generateElement({
                        class: "leaderScore",
                        text: o.numberFormat(e[i + 2]) || "0"
                    })]
                })
                t++;
            }
        }
        let Ai = null;

        function Di(e, t, i, n) {
            ve.save(),
                ve.setTransform(1, 0, 0, 1, 0, 0),
                ve.scale(V, V);
            var s = 50;
            ve.beginPath(),
                ve.arc(e, t, s, 0, 2 * Math.PI, !1),
                ve.closePath(),
                ve.fillStyle = "rgba(255, 255, 255, 0.3)",
                ve.fill(),
                s = 50;
            var o = i - e,
                a = n - t,
                r = Math.sqrt(Math.pow(o, 2) + Math.pow(a, 2)),
                c = r > s ? r / s : 1;
            o /= c,
                a /= c,
                ve.beginPath(),
                ve.arc(e + o, t + a, .5 * s, 0, 2 * Math.PI, !1),
                ve.closePath(),
                ve.fillStyle = "white",
                ve.fill(),
                ve.restore()
        }

        function Ui(e, t, i) {
            for (var n = 0; n < Y.length; ++n)
                (U = Y[n]).active && U.layer == e && (U.update(E),
                                                      U.active && pn(U.x - t, U.y - i, U.scale) && (ve.save(),
                                                                                                    ve.translate(U.x - t, U.y - i),
                                                                                                    ve.rotate(U.dir),
                                                                                                    Li(0, 0, U, ve, 1),
                                                                                                    ve.restore()))
        }
        var Ri = {};

        function Li(e, t, i, n, s) {
            if (i.src) {
                var o = l.projectiles[i.indx].src,
                    a = Ri[o];
                a || ((a = new Image).onload = function() {
                    this.isLoaded = !0
                },
                      a.src = getTexturePackImg(o, "weapons"),
                      Ri[o] = a),
                    a.isLoaded && n.drawImage(a, e - i.scale / 2, t - i.scale / 2, i.scale, i.scale)
            } else
                1 == i.indx && (n.fillStyle = "#939393",
                                en(e, t, i.scale, n))
        }

        function zi(e, t, i, n) {
            var s = r.riverWidth + n,
                o = r.mapScale / 2 - t - s / 2;
            o < re && o + s > 0 && i.fillRect(0, o, ae, s)
        }

        function _i(e, t, i) {
            for (var n, s, o, a = 0; a < N.length; ++a)
                if ((U = N[a]).active) {
                    s = U.x + U.xWiggle - t;
                    o = U.y + U.yWiggle - i;
                    0 == e && U.update(E);
                    if (U.layer == e && pn(s, o, U.scale + (U.blocker || 0))) {
                        let value = 600
                        ve.globalAlpha = cdf(U, A) > 1300? 0:(cdf(U, A) < value? 1: 1-((cdf(U, A)-value)/(1300-value))) * (U.hideFromEnemy ? .6 : 1);
                        ve.shadowBlur = 0;
                        ve.shadowColor = "rgba(0,0,0,0)";
                        if (U.isItem) {
                            n = Zi(U);
                            ve.save();
                            ve.translate(s, o);
                            ve.rotate(U.dir);
                            ve.drawImage(n, -n.width / 2, -n.height / 2);
                            U.blocker && (ve.strokeStyle = "#db6e6e",
                                          ve.globalAlpha = .3,
                                          ve.lineWidth = 6,
                                          en(0, 0, U.blocker, ve, !1, !0));
                            /*/spik/.test(U.name)&& U.owner && (
                             ve.globalAlpha = 1,
                             ve.shadowColor = 'rgba(61, 63, 66, 0)',
                             ve.fillStyle = (player && U.owner && U.owner.sid == player.sid ? "rgba(0,0,0,0)" :(U.owner && player && player.team && isAlly(U.owner.sid)?"rgba(0,0,0,0)":"#A53F3F")),
                             en(0, 0, U.scale / 3.2, ve, true, false));*/
                            ve.restore();
                        } else {
                            ve.save();
                            renderResTest(U, s, o)
                            ve.restore();
                        }
                    }
                }
        }
        let treeAlphaState = [];
        function renderResTest(y, n, r, offsets) {
            let s = Qi(y);
            let easeScale = 0.06, lowestAlpha = 0.5;
            if (A && y.type === 0) {
                if (!treeAlphaState[y.sid]) treeAlphaState[y.sid] = 1;
                if (Math.hypot(y.y - A.y2, y.x - A.x2) <= y.scale + A.scale + 100) {
                    treeAlphaState[y.sid] = Math.max(lowestAlpha, (treeAlphaState[y.sid] - easeScale));
                    ve.globalAlpha = treeAlphaState[y.sid];
                    ve.filter = "blur(5px)";
                } else {
                    //reset the alpha
                    treeAlphaState[y.sid] = Math.min(1, (treeAlphaState[y.sid] + easeScale));
                    ve.globalAlpha = treeAlphaState[y.sid];
                    ve.filter = "none";
                };
            }
            ve.drawImage(s, n - s.width / 2, r - s.height / 2);
        }
        function randColor () {
            let h, s, l;
            let color = (() => {
                const randomInt = (min, max) => {
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                };
                h = randomInt(0, 360);
                s = randomInt(42, 98);
                l = randomInt(40, 90);
                // return `hsl(${h},${s}%,${l}%)`;
            })();
            //and love https://stackoverflow.com/questions/36721830/convert-hsl-to-rgb-and-hex
            function hslToHex(h, s, l) {
                l /= 100;
                const a = s * Math.min(l, 1 - l) / 100;
                const f = n => {
                    const k = (n + h / 30) % 12;
                    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                    return Math.round(255 * color).toString(16).padStart(2, '0');// convert to Hex and prefix "0" if needed
                };
                return `#${f(0)}${f(8)}${f(4)}`;
            }
            return hslToHex(h, s, l);
        }
        function Fi(e, t, i, isFixed) {
            if (isFixed) {
                if (U = findP(e)) {
                    U.hitTime = tick;
                    U.reloads[i] = l.weapons[i].speed;
                    U.weapons[Number(i > 8)] = i;
                    let variant = U.variants[i];
                    let weapon = l.weapons[i];
                    let damage = l.weapons[i].dmg * (U.skin?.dmgMultO || 1) * (U.tail?.dmgMultO || 1) * variant.val;
                    let damageB = l.weapons[i].dmg * (l.weapons[i].sDmg || 1) * (U.skin?.bDmg || 1) * variant.val;
                    if (t) {
                        for (let h of N) {
                            if (!h.foundHitter && h.active && tick - h.lastWiggle <= oT && cdf(h, U) - h.scale <= weapon.range && utils.getAngleDist(U.d2, caf(U, h)) <= Math.PI / 2.6) {
                                h.foundHitter = U;
                                h.health = Math.max(0, h.health - damageB);
                                bnum && h.health && m.showText(h.x, h.y, 30, 0.05, 550, Math.abs(Math.round(damageB)), randColor ())
                                /*if(cdf(A, h) < 200 && h.health <= 272.58){
                                    setTimeout(()=>{
                                        pf(A.items[2], caf(A, h));
                                    }, weapon.speed + oT*1.5);//building health
                                }*/
                            }
                        }
                    }
                    for (let h of players) {
                        let _damage = damage * (h.skin?.dmgMult || 1);
                        if (U != h && _damage == -h.lastBleed.amount && tick - h.lastBleed.time <= oT && cdf(h, U) - 63 <= weapon.range * 2 && utils.getAngleDist(U.d2, caf(U, h)) <= Math.PI / 2.6) {
                            if (U == A) {
                                if (!isAlly(U, h)) {
                                    if (h.skinIndex == 11 && h.tailIndex == 21 && canAntiBull(A) && canAntiBull(U)) {
                                        if (A.shameCount <= 5) {
                                            pf(A.items[0]);
                                        } else {
                                            equiper++;
                                            forceEquip = [6, 13];
                                            ef(forceEquip[0], 0);
                                            ef(forceEquip[1], 1);
                                            setTimeout(() => {
                                                equiper--;
                                            }, oT);
                                        }
                                    }
                                }
                            } else if (!isAlly(U, h)) {
                                if (h == A) {
                                    if ([3, 4, 5].includes(i) && U.tailIndex != 11) {
                                        if (!antiSync.weapons.hits.includes(e)) {
                                            antiSync.weapons.hits.push(e);
                                            if (antiSync.weapons.time && tick - antiSync.weapons.time > 3) {
                                                antiSync.weapons.time = 0;
                                                antiSync.weapons.hits = [];
                                            } else {
                                                antiSync.weapons.time = tick;
                                            }
                                            if (antiSync.weapons.hits.length >= 2) {
                                                antiSync.weapons.hits = [];
                                                antiSync.weapons.time = 0;
                                                if (A.shameCount <= 5) {
                                                    pf(A.items[0]);
                                                } else {
                                                    equiper++;
                                                    forceEquip = [6, 13];
                                                    ef(forceEquip[0], 0);
                                                    ef(forceEquip[1], 1);
                                                    setTimeout(() => {
                                                        equiper--;
                                                    }, oT);
                                                }
                                            }
                                        }
                                    }
                                    if (A.tailIndex == 21) {
                                        autoKillerHit.run(U);
                                    }
                                }
                            }
                            if ((U.skinIndex == 21 || variant.poison)) {
                                h.dmgOverTime.amount = -5;
                                h.dmgOverTime.time = 4;
                                setTimeout(() => {
                                    h.dmgOverTime.time = -1;
                                }, 5e3);
                            }
                        }
                    }
                }
            } else {
                fixed.push({
                    run: Fi,
                    datas: [e, t, i, true]
                });
                findP(e)?.startAnim(t, i);
            }
        }
        let freA = false

        function Hi(e, t, i) {
            ve.globalAlpha = 1;
            let customDir = ci();
            if (lastWorked.autoReplacer) {
                customDir = toR(Math.random() * 360);
            } else if ([...autos, autoOneTick].find(z => z.toDo.length) || scriptMode == "plagueClick" || scriptMode == "bullClick" || scriptMode == "autoBreak") {
                customDir = A.d2;
            }
            for (var n = 0; n < X.length; ++n)
                (U = X[n]).zIndex == i && (U.animate(E),
                                           U.visible && (U.skinRot += .002 * E,
                                                         z = (U == A && freA ? ci() : U.dir) + U.dirPlus,
                                                         ve.save(),
                                                         ve.translate(U.x - e, U.y - t),
                                                         ve.rotate(z),
                                                         ve.globalAlpha = cdf(U, A) < 400? 1: 1-((cdf(U, A)-400)/900),
                                                         Vi(U, ve),
                                                         ve.restore()));
        }

        function Vi(e, t) {
            (t = t || ve).lineWidth = 5.5,
                t.lineJoin = "miter";
            var i = Math.PI / 4 * (l.weapons[e.weaponIndex].armS || 1),
                n = e.buildIndex < 0 && l.weapons[e.weaponIndex].hndS || 1,
                s = e.buildIndex < 0 && l.weapons[e.weaponIndex].hndD || 1;
            if (e.tailIndex > 0 && function(e, t, i) {
                if (!(qi = Gi[e])) {
                    var n = new Image;
                    n.onload = function() {
                        this.isLoaded = !0,
                            this.onload = null
                    },
                        n.src = ".././img/accessories/access_" + e + ".png",
                        Gi[e] = n,
                        qi = n
                }
                var s = Ni[e];
                if (!s) {
                    for (var o = 0; o < et.length; ++o)
                        if (et[o].id == e) {
                            s = et[o];
                            break
                        }
                    Ni[e] = s
                }
                qi.isLoaded && (t.save(),
                                t.translate(-20 - (s.xOff || 0), 0),
                                s.spin && t.rotate(i.skinRot),
                                t.drawImage(qi, -s.scale / 2, -s.scale / 2, s.scale, s.scale),
                                t.restore())
            }(e.tailIndex, t, e),
                e.buildIndex < 0 && !l.weapons[e.weaponIndex].aboveHand && (Ki(l.weapons[e.weaponIndex], r.weaponVariants[e.weaponVariant].src, e.scale, 0, t),
                                                                            null == l.weapons[e.weaponIndex].projectile || l.weapons[e.weaponIndex].hideProjectile || Li(e.scale, 0, l.projectiles[l.weapons[e.weaponIndex].projectile], ve)),
                t.fillStyle = r.skinColors[e.skinColor],
                en(e.scale * Math.cos(i), e.scale * Math.sin(i), 14),
                en(e.scale * s * Math.cos(-i * n), e.scale * s * Math.sin(-i * n), 14),
                e.buildIndex < 0 && l.weapons[e.weaponIndex].aboveHand && (Ki(l.weapons[e.weaponIndex], r.weaponVariants[e.weaponVariant].src, e.scale, 0, t),
                                                                           null == l.weapons[e.weaponIndex].projectile || l.weapons[e.weaponIndex].hideProjectile || Li(e.scale, 0, l.projectiles[l.weapons[e.weaponIndex].projectile], ve)),
                e.buildIndex >= 0) {
                var o = Zi(l.list[e.buildIndex]);
                t.drawImage(o, e.scale - l.list[e.buildIndex].holdOffset, -o.width / 2)
            }
            en(0, 0, e.scale, t),
                e.skinIndex > 0 && (t.rotate(Math.PI / 2),
                                    function e(t, i, n, s) {
                if (!(qi = Wi[t])) {
                    var o = new Image;
                    o.onload = function() {
                        this.isLoaded = !0,
                            this.onload = null
                    },
                        o.src = getTexturePackImg(t, "hat"),
                        Wi[t] = o,
                        qi = o
                }
                var a = n || Xi[t];
                if (!a) {
                    for (var r = 0; r < Ze.length; ++r)
                        if (Ze[r].id == t) {
                            a = Ze[r];
                            break
                        }
                    Xi[t] = a
                }
                qi.isLoaded && i.drawImage(qi, -a.scale / 2, -a.scale / 2, a.scale, a.scale),
                    !n && a.topSprite && (i.save(),
                                          i.rotate(s.skinRot),
                                          e(t + "_top", i, a, s),
                                          i.restore())
            }(e.skinIndex, t, null, e))
        }
        var qi, Wi = {},
            Xi = {},
            Gi = {},
            Ni = {},
            Yi = {};

        function Ki(e, t, i, n, s) {
            var o = e.src + (t || ""),
                a = Yi[o];
            a || ((a = new Image).onload = function() {
                this.isLoaded = !0
            },
                  a.src = getTexturePackImg(o, "weapons"),
                  Yi[o] = a),
                a.isLoaded && s.drawImage(a, i + e.xOff - e.length / 2, n + e.yOff - e.width / 2, e.length, e.width)
        }
        var Ji = {};

        function Qi(e) {
            var t = e.y >= r.mapScale - r.snowBiomeTop ? 2 : e.y <= r.snowBiomeTop ? 1 : 0,
                i = e.type + "_" + e.scale + "_" + t,
                n = Ji[i];
            if (!n) {
                var s = document.createElement("canvas");
                s.width = s.height = 2.1 * e.scale + 5.5;
                var a = s.getContext("2d");
                if (a.translate(s.width / 2, s.height / 2),
                    a.rotate(o.randFloat(0, Math.PI)),
                    a.strokeStyle = it,
                    a.lineWidth = 5.5,
                    0 == e.type)
                    for (var c, l = 0; l < 2; ++l)
                        tn(a, 7, c = U.scale * (l ? .5 : 1), .7 * c),
                            a.fillStyle = t ? l ? "#fff" : "#e3f1f4" : l ? "#b4db62" : "#9ebf57",
                            a.fill(),
                            l || a.stroke();
                else if (1 == e.type)
                    if (2 == t)
                        a.fillStyle = "#606060",
                            tn(a, 6, .3 * e.scale, .71 * e.scale),
                            a.fill(),
                            a.stroke(),
                            a.fillStyle = "#89a54c",
                            en(0, 0, .55 * e.scale, a),
                            a.fillStyle = "#a5c65b",
                            en(0, 0, .3 * e.scale, a, !0);
                    else {
                        var h;
                        ! function(e, t, i, n) {
                            var s, a = Math.PI / 2 * 3,
                                r = Math.PI / 6;
                            e.beginPath(),
                                e.moveTo(0, -n);
                            for (var c = 0; c < 6; c++)
                                s = o.randInt(i + .9, 1.2 * i),
                                    e.quadraticCurveTo(Math.cos(a + r) * s, Math.sin(a + r) * s, Math.cos(a + 2 * r) * n, Math.sin(a + 2 * r) * n),
                                    a += 2 * r;
                            e.lineTo(0, -n),
                                e.closePath()
                        }(a, 0, U.scale, .7 * U.scale),
                            a.fillStyle = t ? "#e3f1f4" : "#89a54c",
                            a.fill(),
                            a.stroke(),
                            a.fillStyle = t ? "#6a64af" : "#c15555";
                        var u = I / 4;
                        for (l = 0; l < 4; ++l)
                            en((h = o.randInt(U.scale / 3.5, U.scale / 2.3)) * Math.cos(u * l), h * Math.sin(u * l), o.randInt(10, 12), a)
                    }
                else
                    2 != e.type && 3 != e.type || (a.fillStyle = 2 == e.type ? 2 == t ? "#938d77" : "#939393" : "#e0c655",
                                                   tn(a, 3, e.scale, e.scale),
                                                   a.fill(),
                                                   a.stroke(),
                                                   a.fillStyle = 2 == e.type ? 2 == t ? "#b2ab90" : "#bcbcbc" : "#ebdca3",
                                                   tn(a, 3, .55 * e.scale, .65 * e.scale),
                                                   a.fill());
                n = s,
                    Ji[i] = n
            }
            return n
        }
        var $i = [];

        function Zi(e, t) {
            var i = $i[e.id + (A && e.owner && e.owner.sid != A.sid && !It.includes(e.owner.sid) ? 25 : 0)];
            if (!i || t) {
                var n = document.createElement("canvas");
                n.width = n.height = 2.5 * e.scale + 5.5 + (l.list[e.id].spritePadding || 0);
                var s = n.getContext("2d");
                if (s.translate(n.width / 2, n.height / 2),
                    s.rotate(t ? 0 : Math.PI / 2),
                    s.strokeStyle = it,
                    s.lineWidth = 5.5 * (t ? n.width / 81 : 1),
                    "apple" == e.name) {
                    s.fillStyle = "#c15555",
                        en(0, 0, e.scale, s),
                        s.fillStyle = "#89a54c";
                    var a = -Math.PI / 2;
                    ! function(e, t, i, n, s) {
                        var o = e + 25 * Math.cos(n),
                            a = t + 25 * Math.sin(n);
                        s.moveTo(e, t),
                            s.beginPath(),
                            s.quadraticCurveTo((e + o) / 2 + 10 * Math.cos(n + Math.PI / 2), (t + a) / 2 + 10 * Math.sin(n + Math.PI / 2), o, a),
                            s.quadraticCurveTo((e + o) / 2 - 10 * Math.cos(n + Math.PI / 2), (t + a) / 2 - 10 * Math.sin(n + Math.PI / 2), e, t),
                            s.closePath(),
                            s.fill(),
                            s.stroke()
                    }(e.scale * Math.cos(a), e.scale * Math.sin(a), 0, a + Math.PI / 2, s)
                } else if ("cookie" == e.name) {
                    s.fillStyle = "#cca861",
                        en(0, 0, e.scale, s),
                        s.fillStyle = "#937c4b";
                    for (var r = I / (h = 4), c = 0; c < h; ++c)
                        en((u = o.randInt(e.scale / 2.5, e.scale / 1.7)) * Math.cos(r * c), u * Math.sin(r * c), o.randInt(4, 5), s, !0)
                } else if ("cheese" == e.name) {
                    var h, u;
                    for (s.fillStyle = "#f4f3ac",
                         en(0, 0, e.scale, s),
                         s.fillStyle = "#c3c28b",
                         r = I / (h = 4),
                         c = 0; c < h; ++c)
                        en((u = o.randInt(e.scale / 2.5, e.scale / 1.7)) * Math.cos(r * c), u * Math.sin(r * c), o.randInt(4, 5), s, !0)
                } else if ("wood wall" == e.name || "stone wall" == e.name || "castle wall" == e.name) {
                    s.fillStyle = "castle wall" == e.name ? "#83898e" : "wood wall" == e.name ? "#a5974c" : "#939393";
                    var d = "castle wall" == e.name ? 4 : 3;
                    tn(s, d, 1.1 * e.scale, 1.1 * e.scale),
                        s.fill(),
                        s.stroke(),
                        s.fillStyle = "castle wall" == e.name ? "#9da4aa" : "wood wall" == e.name ? "#c9b758" : "#bcbcbc",
                        tn(s, d, .65 * e.scale, .65 * e.scale),
                        s.fill()
                } else if ("spikes" == e.name || "greater spikes" == e.name || "poison spikes" == e.name || "spinning spikes" == e.name) {
                    s.fillStyle = "poison spikes" == e.name ? "#7b935d" : "#939393";
                    var f = .6 * e.scale;
                    tn(s, "spikes" == e.name ? 5 : 6, e.scale, f),
                        s.fill(),
                        s.stroke(),
                        s.fillStyle = "#a5974c",
                        en(0, 0, f, s),
                        s.fillStyle = A && e.owner && e.owner.sid != A.sid && !It.includes(e.owner.sid) ? "#AA2C2C" : "#c9b758",
                        en(0, 0, f / 2, s, !0)
                } else if ("windmill" == e.name || "faster windmill" == e.name || "power mill" == e.name)
                    s.fillStyle = "#a5974c",
                        en(0, 0, e.scale, s),
                        s.fillStyle = "#c9b758",
                        sn(0, 0, 1.5 * e.scale, 29, 4, s),
                        s.fillStyle = "#a5974c",
                        en(0, 0, .5 * e.scale, s);
                else if ("mine" == e.name)
                    s.fillStyle = "#939393",
                        tn(s, 3, e.scale, e.scale),
                        s.fill(),
                        s.stroke(),
                        s.fillStyle = "#bcbcbc",
                        tn(s, 3, .55 * e.scale, .65 * e.scale),
                        s.fill();
                else if ("sapling" == e.name)
                    for (c = 0; c < 2; ++c)
                        tn(s, 7, f = e.scale * (c ? .5 : 1), .7 * f),
                            s.fillStyle = c ? "#b4db62" : "#9ebf57",
                            s.fill(),
                            c || s.stroke();
                else if ("pit trap" == e.name)
                    s.fillStyle = "#a5974c",
                        tn(s, 3, 1.1 * e.scale, 1.1 * e.scale),
                        s.fill(),
                        s.stroke(),
                        s.fillStyle = A && e.owner && e.owner.sid != A.sid && !It.includes(e.owner.sid) ? "#AA2C2C" : it,
                        tn(s, 3, .65 * e.scale, .65 * e.scale),
                        s.fill();
                else if ("boost pad" == e.name)
                    s.fillStyle = "#7e7f82",
                        nn(0, 0, 2 * e.scale, 2 * e.scale, s),
                        s.fill(),
                        s.stroke(),
                        s.fillStyle = "#dbd97d",
                        function(e, t) {
                        t = t || ve;
                        var i = e * (Math.sqrt(3) / 2);
                        t.beginPath(),
                            t.moveTo(0, -i / 2),
                            t.lineTo(-e / 2, i / 2),
                            t.lineTo(e / 2, i / 2),
                            t.lineTo(0, -i / 2),
                            t.fill(),
                            t.closePath()
                    }(1 * e.scale, s);
                else if ("turret" == e.name)
                    s.fillStyle = "#a5974c",
                        en(0, 0, e.scale, s),
                        s.fill(),
                        s.stroke(),
                        s.fillStyle = "#939393",
                        nn(0, -25, .9 * e.scale, 50, s),
                        en(0, 0, .6 * e.scale, s),
                        s.fill(),
                        s.stroke();
                else if ("platform" == e.name) {
                    s.fillStyle = "#cebd5f";
                    var p = 2 * e.scale,
                        g = p / 4,
                        m = -e.scale / 2;
                    for (c = 0; c < 4; ++c)
                        nn(m - g / 2, 0, g, 2 * e.scale, s),
                            s.fill(),
                            s.stroke(),
                            m += p / 4
                } else
                    "healing pad" == e.name ? (s.fillStyle = "#7e7f82",
                                               nn(0, 0, 2 * e.scale, 2 * e.scale, s),
                                               s.fill(),
                                               s.stroke(),
                                               s.fillStyle = "#db6e6e",
                                               sn(0, 0, .65 * e.scale, 20, 4, s, !0)) : "spawn pad" == e.name ? (s.fillStyle = "#7e7f82",
                                                                                                                 nn(0, 0, 2 * e.scale, 2 * e.scale, s),
                                                                                                                 s.fill(),
                                                                                                                 s.stroke(),
                                                                                                                 s.fillStyle = "#71aad6",
                                                                                                                 en(0, 0, .6 * e.scale, s)) : "blocker" == e.name ? (s.fillStyle = "#7e7f82",
                        en(0, 0, e.scale, s),
                        s.fill(),
                        s.stroke(),
                        s.rotate(Math.PI / 4),
                        s.fillStyle = "#db6e6e",
                        sn(0, 0, .65 * e.scale, 20, 4, s, !0)) : "teleporter" == e.name && (s.fillStyle = "#7e7f82",
                                                                                            en(0, 0, e.scale, s),
                                                                                            s.fill(),
                                                                                            s.stroke(),
                                                                                            s.rotate(Math.PI / 4),
                                                                                            s.fillStyle = "#d76edb",
                                                                                            en(0, 0, .5 * e.scale, s, !0));
                i = n,
                    t || ($i[e.id + (A && e.owner && e.owner.sid != A.sid && !It.includes(e.owner.sid) ? 25 : 0)] = i)
            }
            return i
        }

        function en(e, t, i, n, s, o) {
            (n = n || ve).beginPath(),
                n.arc(e, t, i, 0, 2 * Math.PI),
                o || n.fill(),
                s || n.stroke()
        }

        function tn(e, t, i, n) {
            var s, o, a = Math.PI / 2 * 3,
                r = Math.PI / t;
            e.beginPath(),
                e.moveTo(0, -i);
            for (var c = 0; c < t; c++)
                s = Math.cos(a) * i,
                    o = Math.sin(a) * i,
                    e.lineTo(s, o),
                    a += r,
                    s = Math.cos(a) * n,
                    o = Math.sin(a) * n,
                    e.lineTo(s, o),
                    a += r;
            e.lineTo(0, -i),
                e.closePath()
        }

        function nn(e, t, i, n, s, o) {
            s.fillRect(e - i / 2, t - n / 2, i, n),
                o || s.strokeRect(e - i / 2, t - n / 2, i, n)
        }

        function sn(e, t, i, n, s, o, a) {
            o.save(),
                o.translate(e, t),
                s = Math.ceil(s / 2);
            for (var r = 0; r < s; r++)
                nn(0, 0, 2 * i, n, o, a),
                    o.rotate(Math.PI / s);
            o.restore()
        }

        function on(e) {
            for (var t = 0; t < e.length;) {
                tt.add(e[t], e[t + 1], e[t + 2], e[t + 3], e[t + 4], e[t + 5], l.list[e[t + 6]], !0, e[t + 7] >= 0 ? {
                    sid: e[t + 7]
                } : null);
                if (e[t + 7] >= 0) {
                    addPla({
                        sid: e[t + 7]
                    });
                }
                (15==e[i+6]&&(A.x2-e[i+1])**2+(A.y2-e[i+2])**2<1e4&&e[i+7]!=A.sid&&!It.includes(e[i+7])) && doAntiTrap(e[i + 6], e[i + 1], e[i + 2]);
                t += 8
            }
        }
        let frozenAngles = [4e306, 8e305, 6e306, 8e302, 4e304, 5e303, 5e306, 1e308, 2e306, 4e305, 3e306, 3e304, 1.2999999999999997e+308, 6e305, 1e307, 7e304];
        function doAntiTrap(id, x, y) {
            for(let i = 0;i < 16;i++){
                pf(A.items[2], frozenAngles[i])
            }
        }
        function an(e, t) {
            if (U = Sn(t)) {
                U.lastWiggle = tick;
                U.foundHitter = false;
                U.xWiggle += r.gatherWiggle * Math.cos(e);
                U.yWiggle += r.gatherWiggle * Math.sin(e);
            }
        }

        function rn(e, t) {
            if (U = Sn(e)) {
                U.dir = t;
                U.xWiggle += r.gatherWiggle * Math.cos(t + Math.PI);
                U.yWiggle += r.gatherWiggle * Math.sin(t + Math.PI);
            }
        }

        function cn(e, t, i, n, s, o, a, r, isFixed) {
            items.projFounds.push([e, t, i, n, s, o, a, r]);
            if (isFixed) {
                let weapon = o == 0 ? 9 : o == 2 ? 12 : o == 3 ? 13 : o == 5 && (15);
                for (let c = 0; c < players.length; c++) {
                    let U = players[c];
                    if (U.visible && (o == 1 ? U.skinIndex == 53 : U.weaponIndex == weapon) && utils.getAngleDist(caf(U, {
                        x: e,
                        y: t
                    }), U.d2) <= Math.PI / 2.6 && cdf(U, {
                        x: e - Math.cos(i) * 35,
                        y: t - Math.sin(i) * 35
                    }) <= 70) {
                        if (o == 1) U.shootCount = 2500;
                        else U.reloads[weapon] = l.weapons[weapon].speed;
                    }
                }
            } else {
                fixed.push({
                    run: cn,
                    datas: [e, t, i, n, s, o, a, r, true]
                });
                K.addProjectile(e, t, i, n, s, o, null, null, a).sid = r;
            }
        }

        function ln(e, t) {
            for (var i = 0; i < Y.length; ++i)
                Y[i].sid == e && (Y[i].range = t)
        }

        function hn(e) {
            (U = xn(e)) && U.startAnim()
        }

        function un(e) {
            animals = [];
            for (var t = 0; t < W.length; ++t)
                W[t].forcePos = !W[t].visible,
                    W[t].visible = !1;
            if (e) {
                var i = Date.now();
                for (t = 0; t < e.length;) {
                    (U = xn(e[t])) ? (U.index = e[t + 1],
                                      U.t1 = void 0 === U.t2 ? i : U.t2,
                                      U.t2 = i,
                                      U.x1 = U.x,
                                      U.y1 = U.y,
                                      U.x2 = e[t + 2],
                                      U.y2 = e[t + 3],
                                      U.d1 = void 0 === U.d2 ? e[t + 4] : U.d2,
                                      U.d2 = e[t + 4],
                                      U.health = e[t + 5],
                                      U.clownTimer = 0,
                                      U.canClownTime = true,
                                      U.clowned = false,
                                      U.clownTimeInt,
                                      U.dt = 0,
                                      U.visible = !0) : ((U = $.spawn(e[t + 2], e[t + 3], e[t + 4], e[t + 1])).x2 = U.x,
                                                         U.y2 = U.y,
                                                         U.d2 = U.dir,
                                                         U.health = e[t + 5],
                                                         $.aiTypes[e[t + 1]].name || (U.name = r.cowNames[e[t + 6]]),
                                                         U.forcePos = !0,
                                                         U.sid = e[t],
                                                         U.visible = !0);
                    animals.push(U);
                    t += 7;
                }
            }
            Tach.updateAnimals(W);
        }
        var dn = {};

        function fn(e, t) {
            var i = e.index,
                n = dn[i];
            if (!n) {
                var s = new Image;
                s.onload = function() {
                    this.isLoaded = !0,
                        this.onload = null
                },
                    s.src = ".././img/animals/" + e.src + ".png",
                    n = s,
                    dn[i] = n
            }
            if (n.isLoaded) {
                var o = 1.2 * e.scale * (e.spriteMlt || 1);
                t.drawImage(n, -o, -o, 2 * o, 2 * o)
            }
        }

        function pn(e, t, i) {
            return e + i >= 0 && e - i <= ae && t + i >= 0 && t - i <= re
        }
        document.getElementById("promoImgHolder").style.display = "none";

        function addPla(e = {}) {
            if (!e.id && !e.sid) return false;
            let i = typeof e.sid == "number" ? bn(e.sid) : (function() {
                for (var t = 0; t < X.length; ++t)
                    if (X[t].id == e.id) return X[t];
            }());
            i || (i = new u(e.id, e.sid, r, o, K, tt, X, W, l, Ze, et), Object.assign(i, e), X.push(i));
            return i;
        }

        function gn(e, t) {
            var i = bn(e[1]) || function(e) {
                for (var t = 0; t < X.length; ++t)
                    if (X[t].id == e)
                        return X[t];
                return null
            }(e[0]);
            i || (i = new u(e[0], e[1], r, o, K, tt, X, W, l, Ze, et),
                  X.push(i)),
                i.spawn(t ? H : null),
                i.visible = !1,
                i.x2 = void 0,
                i.y2 = void 0,
                i.setData(e),
                t && (R = (A = i).x,
                      L = A.y,
                      Nt(),
                      Mi(),
                      Bi(),
                      Oi(0),
                      Ee.style.display = "block")
        }

        function mn(e) {
            for (var t = 0; t < X.length; t++)
                if (X[t].id == e) {
                    X.splice(t, 1);
                    break
                }
        }

        function yn(e, t) {
            A && (A.itemCounts[e] = t, updC(e, t))
        }

        function kn(e, t, i) {
            A && (A[e] = t,
                  i && Mi())
        }
        var autoHeal;
        var deadPlayer = [];
        function wn(e, t) {
            if (U = findP(e)) {
                let a = t - U.health;
                U.health = t;
                if (U.health <= 0) {
                    return U.alive = false;
                }
                if (a < 0) {
                    if (a == -5 * (U.skin?.dmgMult || 1) && U.dmgOverTime.time > -1) {
                        U.dmgOverTime.time--;
                    }
                    let len = enemies.length;
                    if (A == U && U.skinIndex == 7 && a == -5 + (U.tailIndex == 13 ? 3 : 0)) {
                        lastBullBleed = tick;
                        startBullBleed = 0;
                    }
                    U.lastBleed.amount = a;
                    U.lastBleed.time = tick;
                    U.lastBleed.healed = false;
                    U.lastDamage = Date.now();
                } else if (a > 0) {
                    if (U.lastDamage !== undefined) {
                        let e = Date.now() - U.lastDamage
                        U.lastDamage = undefined;
                        if (e < 120) {
                            U.shameCount = Math.min(7, U.shameCount + 1);
                        } else {
                            U.shameCount = Math.max(0, U.shameCount - 2);
                        }
                        U.lastBleed.healed = true;
                    }
                }
                if(U.health <= 0){
                    deadPlayer.push({obj: U, time: Date.now()});
                }
                if (A == U) { //anti
                    let minDamage = -26;
                    if (enemies.find(z => cdf(z, A) < 300) && ((a >= -17.7 && a <= -10) || a <= minDamage) && a != -50 * (A.skin?.dmgMult || 1)) {
                        if (A.shameCount <= 3) {
                            for (let v = 0; v < 4; v++) pf(A.items[0]);
                        } else {
                            equiper++;
                            forceEquip = [22, 13];
                            ef(forceEquip[0], 0);
                            ef(forceEquip[1], 1);
                            setTimeout(() => {
                                forceEquip = [6, 13];
                                ef(forceEquip[0], 0);
                                ef(forceEquip[1], 1);
                                setTimeout(() => {
                                    equiper--;
                                }, oT);
                            }, oT);
                        }
                    }
                    if (A.health < 100) {
                        clearInterval(autoHeal);
                        autoHeal = setInterval(() => {
                            if (A.alive && A.health < 100) {
                                if (tick - A.lastBleed.time > 1) {
                                    for (let v = 0; v < Math.ceil((100 - t) / l.list[A.items[0]].consume); v++) pf(A.items[0]) && clearInterval(autoHeal);
                                }
                            } else clearInterval(autoHeal);
                        }, 30);
                    }
                } else if (isAlly(A, U)) {} else if (a < 0) {}
            }
        }
        function renderDeadPlayer(e, t) {
            (t = t || ve).lineWidth = 5.5,
                t.lineJoin = "miter";
            var i = Math.PI / 4 * (l.weapons[e.weaponIndex].armS || 1)
            , n = e.buildIndex < 0 && l.weapons[e.weaponIndex].hndS || 1
            , s = e.buildIndex < 0 && l.weapons[e.weaponIndex].hndD || 1;
            if (e.tailIndex > 0 && function(e, t, i) {
                if (!(qi = Gi[e])) {
                    var n = new Image;
                    n.onload = function() {
                        this.isLoaded = !0,
                            this.onload = null
                    }
                        ,
                        n.src = ".././img/accessories/access_" + e + ".png",
                        Gi[e] = n,
                        qi = n
                }
                var s = Ni[e];
                if (!s) {
                    for (var o = 0; o < et.length; ++o)
                        if (et[o].id == e) {
                            s = et[o];
                            break
                        }
                    Ni[e] = s
                }
                qi.isLoaded && (t.save(),
                                t.translate(-20 - (s.xOff || 0), 0),
                                s.spin && t.rotate(i.skinRot),
                                t.drawImage(qi, -s.scale / 2, -s.scale / 2, s.scale, s.scale),
                                t.restore())
            }(13, t, e),
                e.buildIndex < 0 && !l.weapons[e.weaponIndex].aboveHand && (Ki(l.weapons[e.weaponIndex], r.weaponVariants[e.weaponVariant].src, e.scale, 0, t),
                                                                            null == l.weapons[e.weaponIndex].projectile || l.weapons[e.weaponIndex].hideProjectile || Li(e.scale, 0, l.projectiles[l.weapons[e.weaponIndex].projectile], ve)),
                t.fillStyle = r.skinColors[4],
                en(e.scale * Math.cos(i), e.scale * Math.sin(i), 14),
                en(e.scale * s * Math.cos(-i * n), e.scale * s * Math.sin(-i * n), 14),
                e.buildIndex < 0 && l.weapons[e.weaponIndex].aboveHand && (Ki(l.weapons[e.weaponIndex], r.weaponVariants[e.weaponVariant].src, e.scale, 0, t),
                                                                           null == l.weapons[e.weaponIndex].projectile || l.weapons[e.weaponIndex].hideProjectile || Li(e.scale, 0, l.projectiles[l.weapons[e.weaponIndex].projectile], ve)),
                e.buildIndex >= 0) {
                var o = Zi(l.list[e.buildIndex]);
                t.drawImage(o, e.scale - l.list[e.buildIndex].holdOffset, -o.width / 2)
            }
            en(0, 0, e.scale, t),
                e.skinIndex > 0 && (t.rotate(Math.PI / 2),
                                    function e(t, i, n, s) {
                if (!(qi = Wi[t])) {
                    var o = new Image;
                    o.onload = function() {
                        this.isLoaded = !0,
                            this.onload = null
                    }
                        ,
                        o.src = ".././img/hats/hat_" + t + ".png",
                        Wi[t] = o,
                        qi = o
                }
                var a = n || Xi[t];
                if (!a) {
                    for (var r = 0; r < Ze.length; ++r)
                        if (Ze[r].id == t) {
                            a = Ze[r];
                            break
                        }
                    Xi[t] = a
                }
                qi.isLoaded && i.drawImage(qi, -a.scale / 2, -a.scale / 2, a.scale, a.scale),
                    !n && a.topSprite && (i.save(),
                                          i.rotate(s.skinRot),
                                          e(t + "_top", i, a, s),
                                          i.restore())
            }(0, t, null, e))
        }
        function doLag() {
            for (let i = 0; i < 15; i++) s.socket.send(111111111);
        }
        var ticked = 0;
        var fixed = [];
        var oT = 1e3 / 9;
        var angle360 = Number.MAX_VALUE;
        var animals = [];
        var buildings = [];
        var players = [],
            player = null;
        var enemies = [],
            enemy = null,
            enemyAng = 0;
        var teammates = [],
            teammate = null;
        var autoKillerHit = {
            toDo: [],
            run: function(other, damage) {
                if (autoKillerHit.toDo.length) return;
                if (!other || !other.visible || other == A) return;
                let ham = A.weapons[1] == 10;
                let noEmpGuy = enemies.find(e => e.skinIndex != 22);
                let tur = A.canShot(other, 1) == true && other == noEmpGuy;
                let turDmg = tur ? 25 * (other.skin?.dmgMult || 1) : 0;
                let health = other.health - (damage ?? 0);
                if (health == 100) return;
                let dist = cdf(A, other);
                let stop = function() {
                    yi(A.weapons[0], true);
                    hf(false);
                };
                let hat = other.skinIndex == 11 ? 22 : 7;
                let remBull = A.variants[A.weapons[0]].id > 0;
                let priDamage = items.weapons[A.weapons[0]].dmg * A.variants[A.weapons[0]].val * (store.hats
                                                                                                  .find(e => e.id == hat)?.dmgMultO || 1) * (other.skin?.dmgMult || 1);
                let secDamage = 10 * A.variants[10].val * (other.skin?.dmgMult || 1);
                if (!A.reloads[10] && ham && dist <= 133 && health <= secDamage + turDmg) {
                    let dir = caf(A, other);
                    autoKillerHit.toDo = [function() {
                        wf(dir);
                        ef(hat, 0);
                        ef(21, 1);
                        yi(A.weapons[1], true);
                        hf(true);
                    }, ];
                    let add = [];
                    if (health <= secDamage) {
                        add = [stop];
                    } else {
                        add = [stop, function() {
                            ef(53, 0);
                        }];
                    }
                    autoKillerHit.toDo.unshift(...add);
                } else if (!A.reloads[A.weapons[0]] && health <= priDamage + turDmg * Number((A.weapons[0] == 5 ? A.variants[5].id < 2 : true)) && dist <= items.weapons[A.weapons[0]].range + 63) {
                    let dir = caf(A, other);
                    autoKillerHit.toDo = [function() {
                        wf(dir);
                        ef(hat, 0);
                        ef(0, 1);
                        yi(A.weapons[0], true);
                        hf(true);
                    }, ];
                    let add = [];
                    if (health <= priDamage) {
                        add = [stop];
                    } else {
                        add = [stop, function() {
                            ef(53, 0);
                        }];
                    }
                    autoKillerHit.toDo.unshift(...add);
                } else if (!A.reloads[A.weapons[0]] && !A.reloads[10] && ham && dist <= 133 && health <= priDamage + secDamage) {
                    let dir = caf(A, other);
                    autoKillerHit.toDo = [stop, function() {
                        yi(A.weapons[0], true);
                        wf(dir);
                    }, function() {
                        wf(dir);
                        ef(hat, 0);
                        ef(0, 1);
                        yi(A.weapons[1], true);
                        hf(true);
                    }, ];
                }
            },
        };
        var autoOneTick = {
            toggle: false,
            auto: true,
            stopHatting: false,
            toDo: [],
            run: function(other) {
                if (autoOneTick.toDo.length) return;
                if (!other || !other.visible || other == A) return;
                let canOT = other.skinIndex != 22 && other.skinIndex != 6;
                let OTType = A.weapons[0] == 5 ? (A.items[4] == 16 && [12, 13].includes(A.weapons[1]) ? "boost pad" : A.variants[5].id >= 2 ? "polearm" : null) : null;
                autoOneTick.stopHatting = false;
                if (!OTType) return false;
                let oldDist = cdf({
                    x: A.x3,
                    y: A.y3
                }, other);
                let dist = cdf(A, other);
                let dir = caf(A, other);
                let oneTickDist = OTType == "polearm" ? [219, 221] : OTType == "boost pad" ? [383, 384] : [0, 0];
                let doOneTick = () => {
                    mf(dir);
                    if (OTType == "polearm") {
                        autoOneTick.toDo = [function() {
                            autoImg.autoOneTick.target = other.sid;
                            mover--;
                            mf(undefined);
                            hf(false);
                        }, function() {
                            autoImg.autoOneTick.target = other.sid;
                            mf(dir);
                            ef(7, 0);
                            wf(dir);
                            hf(true);
                        }, function() {
                            autoImg.autoOneTick.target = other.sid;
                            mf(dir);
                            ef(53, 0);
                            ef(0, 1);
                            yi(A.weapons[0], true);
                            mover++;
                        }];
                    } else if (OTType == "boost pad") {
                        autoOneTick.toDo = [function() {
                            autoImg.autoOneTick.target = other.sid;
                            mover--;
                            mf(undefined);
                            hf(false);
                        }, function() {
                            autoImg.autoOneTick.target = other.sid;
                            yi(A.weapons[0], true);
                            mf(dir);
                            ef(7, 0);
                            wf(dir);
                        }, function() {
                            autoImg.autoOneTick.target = other.sid;
                            mf(dir);
                            ef(53, 0);
                            pf(A.items[4], dir);
                            yi(A.weapons[1], true);
                            hf(true);
                            mover++;
                        }];
                    }
                };
                if (other.inTrap && A.canShot(other, 1) == true && canMove(A, other)) {
                    if (autoOneTick.toggle) {
                        if (dist >= oneTickDist[0] - 40 && dist <= oneTickDist[1] + 40) {
                            autoImg.autoOneTick.target = other.sid;
                            if (dist >= oneTickDist[0] && dist <= oneTickDist[1]) {
                                mf(undefined);
                                if (Math.abs(dist - oldDist) < 5) {
                                    canOT && doOneTick();
                                }
                            } else {
                                ef(dist >= oneTickDist[0] - 20 && dist <= oneTickDist[1] + 20 ? 40 : 22, 0);
                                ef(0, 1);
                                mf(dist < oneTickDist[0] ? dir + Math.PI : dir);
                                autoOneTick.stopHatting = true;
                            }
                        } else {
                            mf(dist < oneTickDist[0] ? dir + Math.PI : dir);
                        }
                    } else if (canOT && dist >= oneTickDist[0] && dist <= oneTickDist[1] + 40) {
                        autoImg.autoOneTick.target = other.sid;
                        if (dist <= oneTickDist[1]) {
                            if (Math.abs(dist - oldDist) < 35) {
                                doOneTick();
                            }
                        } else {
                            ef(dist < oneTickDist[0] + 20 ? 40 : 22, 0);
                            ef(0, 1);
                            autoOneTick.stopHatting = true;
                        }
                    }
                }
            },
        };
        var aimer;
        function autoaim(boolean) {
            if (boolean) {
                aimer = setInterval( () => {
                    s.send("2", enemyAng);
                }, 0);
            } else {
                clearInterval(aimer);
                s.send("2", enemyAng);
            }
        }
        function updC(e, t) {
            try {
                if (e == 1) {
                    numArr(19, 22, (i) => {
                        document.getElementById("itemCounts" + i.toString()).innerHTML = t;
                    });
                } else if (e == 2) {
                    numArr(22, 26, (i) => {
                        document.getElementById("itemCounts" + i.toString()).innerHTML = t;
                    });
                } else if (e == 3) {
                    numArr(26, 29, (i) => {
                        document.getElementById("itemCounts" + i.toString()).innerHTML = t;
                    });
                } else if (e == 4) {
                    document.getElementById("itemCounts29").innerHTML = t;
                } else if (e >= 5 && e <= 10) {
                    document.getElementById(`itemCounts${e + 26}`).innerHTML = t;
                } else if (e == 11) {
                    document.getElementById("itemCounts30").innerHTML = t;
                } else if (e >= 12 && e <= 13) {
                    document.getElementById(`itemCounts${e + 25}`).innerHTML = t;
                }
            } catch (e) {}
        }
        var autoInstakill = {
            toggle: false,
            toDo: [],
            run: function(other, damage) {
                if (autoInstakill.toDo.length) return;
                if (!other || !other.visible || other == A) return;
                if (j) return;
                let ham = A.weapons[1] == 10;
                let pro = A.weapons[1] && items.weapons[A.weapons[1]]?.projectile != undefined;
                let proRang = pro ? items.projectiles[items.weapons[A.weapons[1]].projectile].range : 90000;
                let proDmg = pro ? items.projectiles[items.weapons[A.weapons[1]].projectile].dmg : 0;
                let noEmpGuy = enemies.find(e => e.skinIndex != 22);
                let tur = A.canShot(other, 1) == true && other == noEmpGuy;
                let turDmg = tur ? 25 * (other.skin?.dmgMult || 1) : 0;
                let health = other.health - (damage ?? 0);
                let stop = function() {
                    yi(A.weapons[0], true);
                    hf(false);
                    autoaim(false)
                };
                let dist = cdf(A, other);
                let dir = caf(A, other);
                let checkCondition = function(weapon, ...indxs) {
                    let dist = cdf(other, A);
                    return dist <= Math.min(ham ? 75 : pro ? proRang : 9999, items.weapons[A.weapons[0]].range) +
                        63 && indxs.every(indx => {
                        if (!A.canShot(other, indx)) return false;
                        return true;
                    });
                };
                if (A.weapons[0]) {
                    if (ham && A.canShot(other, 1) == true) {
                        let hat = other.skinIndex == 11 ? 22 : 7;
                        let remBull = A.variants[A.weapons[0]].id > 0;
                        let priDamage = items.weapons[A.weapons[0]].dmg * A.variants[A.weapons[0]].val * (store
                                                                                                          .hats.find(e => e.id == hat)?.dmgMultO || 1) * (other.skin?.dmgMult || 1);
                        let secDamage = 10 * A.variants[10].val * (other.skin?.dmgMult || 1);
                        autoImg.autoInstakill.target = other.sid;
                        if(dist > 134 && (other.skinIndex == 6 || other.skinIndex == 26)) return;
                        if (A.reloads[A.weapons[0]] || A.reloads[A.weapons[1]]) return;
                        autoInstakill.toDo = [function() {
                            ef(hat, 0);
                            yi(A.weapons[0], true);
                            wf(dir);
                        }, function() {
                            autoaim(true)
                            wf(dir);
                            ef(remBull ? 53 : hat, 0);
                            ef(0, 1);
                            yi(A.weapons[1], true);
                            hf(true);
                        }];
                        let add = [];
                        if (remBull) {
                            add = [stop];
                        } else {
                            add = [stop, function() {
                                ef(53, 0);
                            }];
                        }
                        autoInstakill.toDo.unshift(...add);
                    } else if (pro && A.canShot(other, items.weapons[A.weapons[1]].projectile) == true) {
                        let hat = other.skinIndex == 11 ? 22 : 7;
                        let priDamage = items.weapons[A.weapons[0]].dmg * A.variants[A.weapons[0]].val * (store
                                                                                                          .hats.find(e => e.id == hat)?.dmgMultO || 1) * (other.skin?.dmgMult || 1);
                        let secDamage = proDmg * (other.skin?.dmgMult || 1);
                        autoImg.autoInstakill.target = other.sid;
                        if(dist - 63 > items.weapons[A.weapons[0]].range) return;
                        if (A.reloads[A.weapons[0]] || A.reloads[A.weapons[1]]) return;
                        let dir = caf(A, other);
                        autoInstakill.toDo = [stop, function() {
                            ef(53, 0);
                            yi(A.weapons[1], true);
                            wf(dir);
                        }, function() {
                            autoaim(true)
                            wf(dir);
                            ef(hat, 0);
                            ef(0, 1);
                            yi(A.weapons[0], true);
                            hf(true);
                        }];
                        let add = [];
                        autoInstakill.toDo.unshift(...add);
                    } else if (A.canShot(other, 1) == true) {
                        if (dist - 63 > items.weapons[A.weapons[0]].range) return;
                        if (A.shootCount || A.reloads[A.weapons[0]]) return;
                    }
                }
            },
        };
        var placer = {
            toggle: false,
            itemIndex: 0,
        };
        var hitToggle = false;
        var autoHitToggle = 0;
        var autoWeaponCharger = {
            needCharge: null,
        };
        var antiSync = {
            projectiles: {
                shots: [],
                time: 0,
            },
            weapons: {
                hits: [],
                time: 0,
            },
        };
        var perma
        var packetEngine = i(38);
        var oldWatchAngle = 0,
            oldMoveAngle = null,
            oldChatText = "",
            oldBuild = -1,
            oldWeapon = 0;
        var sentDatas = {
            lastTry: {
                equip: {
                    skinIndex: 0,
                    tailIndex: 0,
                },
                buy: {
                    skinIndex: 0,
                    tailIndex: 0,
                },
                choose: [-1, null],
            },
            skins: [],
            tails: [],
        };
        var scriptMode = "";
        var lastBullBleed = 0;
        var startBullBleed = 0;
        var tick = 0;
        var forceEquip = [];
        var equiper = 0,
            watcher = 0,
            mover = 0;
        var autos = [autoKillerHit, autoInstakill];
        var anythingWorks = function() {
            let anyAutoWorking = [...autos, autoOneTick].find(e => e.toDo.length);
            return anyAutoWorking || equiper || mover;
        };
        var singing = {
            audio: null,
            name: "",
            timeouts: [],
            toggle: false,
        };
        var lastWorked = {
            autoReplacer: false,
            autoPlacer: false,
        };
        var antiInstaWorked = 0;
        var predicts = {
            "12": {
                userTrap: {
                    spikeTick: []
                },
            },
            "7": {
                primary: [],
                current: [],
            },
        };
        var autoImg = i(41);
        var {
            camFollow,
            autoGrind,
            autoMill,
            autoPlacer,
            showTrapRadar,
            pathFinder
        } = i(39);
        let shadowMode = true;
        function preplace(){
            if(!enemies.length) return
            if(A && enemy && Math.hypot(A.x2 - enemy.x2, A.y2 - enemy.y2) <= 1000){//only if item dist is less than A dist
                let buildings = N.filter((a) => a.health < 278 && Math.hypot(a.y - A.y2, a.x - A.x2) < 200 && Math.hypot(a.y - enemy.y2, a.x - enemy.x2) < 200 && a.active && a.name !== null);
                if(buildings.length > 0){
                    buildings.forEach(e => {
                        let angle = Math.atan2(e.y-A.y, e.x-A.x);
                        let spikes = N.some(e => {
                            if(e.name && e.active && /spik/.test(e.name) && Math.hypot(e.y - A.y2, e.x - A.x2) < 222 && e.owner.sid != A.sid && (A.team ? !It.includes(e.owner.sid) : 1)) {
                                return true;
                            }
                            return false;
                        });
                        console.log(2)
                        //let a = setInterval (() => {
                        for(let i = 0; i < 2; i++)pf(A.items[2], angle);
                        for (let i=angle-Math.PI/3; i<angle+Math.PI/3; i+=Math.PI/18){
                            p(player.items[2], i);
                        }
                        //});
                        setTimeout(() => {
                            //clearInterval(a);
                        },oT);
                    });
                }
            }
        }
        function preplace2(_){
            if (_.reloads[_.weaponIndex] <= 1000 / 9) {
                //pf(A.items[2], ci());
                let index = _.weaponIndex;
                let nearObja = N.filter((e) => (e.active || e.alive) && e.health < findItemHealth({name: e.name})?.health && e.group !== undefined && cdf(e, A) <= (items.weapons[A.weaponIndex].range + e.scale));
                for (let i = 0; i < nearObja.length; i++) {
                    let aaa = nearObja[i];
                    let variant = _.variants[index];
                    let valaa = items.weapons[index].dmg * (items.weapons[index].sDmg || 1) * (_.skin?.bDmg || 1) * variant.val;
                    if (aaa.health - (valaa) <= 0) {
                        for(let i = 0; i < 2; i++)pf(cdf(enemy, A) < ((35 * 1.8) + 50) ? A.items[4] : A.items[2], caf(aaa, A) + Math.PI);
                    }
                }
            }
        }
        let findSpikeHit = {
            x: 0,
            y: 0,
            spikePosX: 0,
            spikePosY: 0,
            canHit: false,
        }
        let spikes = []
        function doSpikeHit(){
            function getDistance(x1, y1, x2, y2) {
                return Math.sqrt((x2 -= x1) * x2 + (y2 -= y1) * y2);
            }
            if(!enemy) return;
            if(enemies.length){
                let a = enemies[0]
                let trap = N.find(e => e.active && "pit trap" == e.name && e.owner.sid != a.sid && getDistance(e.x, e.y, a.x2, a.y2) <= 50);
                let speed = (0.3 + (items.weapons[A.weapons[0]].knock||0));
                let angle = Math.atan2(a.y2 - A.y2, a.x2 - A.x2);//Math.atan2(player.y2 - a.y2, player.x2 - a.x2);
                let hitsPos = {
                    x: a.x2 + speed * Math.cos(angle) * 224,
                    y: a.y2 + speed * Math.sin(angle) * 224,
                }
                if(cdf(enemy, A) < items.weapons[A.weapons[0]].range+70 && enemy){
                    findSpikeHit.x = hitsPos.x
                    findSpikeHit.y = hitsPos.y
                }
                spikes = N.filter(e => e.active && e.dmg && e.owner.sid != a.sid && getDistance(e.x, e.y, hitsPos.x, hitsPos.y) <= 35+e.scale)
                for(let i = 0; i<spikes.length;i++){
                    let spike = spikes[i]
                    if(spike && enemy && cdf(enemy, A) < items.weapons[A.weapons[0]].range+70){
                        if(!trap) {
                            autoKillerHit.run(a, 75);
                        }
                        findSpikeHit.canHit = true;
                        findSpikeHit.spikePosX = spike.x;
                        findSpikeHit.spikePosY = spike.y;
                        addFunction(()=>{
                            findSpikeHit.spikePosX = 0;
                            findSpikeHit.spikePosY = 0;
                            findSpikeHit.canHit = false;
                        },2)
                    } else {
                        findSpikeHit.spikePosX = 0;
                        findSpikeHit.spikePosY = 0;
                        findSpikeHit.canHit = false;
                    }
                }
            }
        }
        function doInitPlayers (tmpObj) {
            if(tmpObj.skinIndex == 45){
                tmpObj.shameCount = "-";
                tmpObj.clowned = true;
                if(tmpObj.canClownTime == true) {
                    tmpObj.clownTimer = 30;
                    tmpObj.canClownTime = false;
                    tmpObj.clownTimeInt = setInterval(() => {
                        tmpObj.clownTimer -= 1;
                        tmpObj.clownTimer <= 0 && (tmpObj.clownTimer = 0);
                    }, 1000);
                    tmpObj.shameCount = 0;
                }
                if(tmpObj == A) {
                    A.clowned = true;
                }
            } else if(tmpObj.shameCount == "-"){
                console.log(1)
                tmpObj.clownTimer = 0;
                tmpObj.canClownTime = true;
                tmpObj.shameCount = 0;
                clearInterval(tmpObj.clownTimeInt);
                tmpObj.clowned = false;
                if(tmpObj == A) {
                    A.clowned = false;
                }
            } else {
                tmpObj.clownTimer = 0;
                tmpObj.canClownTime = true;
                tmpObj.clowned = false;
                clearInterval(tmpObj.clownTimeInt);
            }
        }
        let queueTick = [];
        function addFunction(action, ticks) {//setTimeout per tick
            if (typeof action != "function"){
                return;}
            if (typeof queueTick[tick + ticks] != "object") {
                queueTick[tick + ticks] = [action];
            } else {
                queueTick[tick + ticks].push(action);
            }
        }
        Pathfinder.setBuildings(N);
        function vn(e) {
            for (let i in autoImg) {
                autoImg[i].target = null;
            }
            tick++;
            predicts["12"].userTrap.spikeTick = [];
            predicts["7"].primary = [];
            predicts["7"].current = [];
            scriptMode = "none";
            players = [];
            player = null;
            enemies = [];
            enemy = null;
            enemyAng = 0;
            teammates = [];
            teammate = null;
            ticked = 0;
            for (var t = Date.now(), i = 0; i < X.length; ++i)
                X[i].forcePos = !X[i].visible,
                    X[i].visible = !1;
            for (i = 0; i < e.length;) {
                if (U = bn(e[i])) {
                    U.t1 = void 0 === U.t2 ? t : U.t2;
                    U.t2 = t;
                    U.x1 = U.x;
                    U.y1 = U.y;
                    U.x3 = U.x2;
                    U.y3 = U.y2;
                    U.x2 = e[i + 1];
                    U.y2 = e[i + 2];
                    U.d1 = void 0 === U.d2 ? e[i + 3] : U.d2;
                    U.d2 = e[i + 3];
                    if (U.dt > 200) {
                        startBullBleed++;
                    }
                    U.dt = 0;
                    U.buildIndex = e[i + 4];
                    U.weaponIndex = e[i + 5];
                    U.weaponVariant = e[i + 6];
                    U.team = e[i + 7];
                    U.isLeader = e[i + 8];
                    U.skinIndex = e[i + 9];
                    U.tailIndex = e[i + 10];
                    U.skin = Ze.find(n => n.id == U.skinIndex);
                    U.tail = et.find(n => n.id == U.tailIndex);
                    U.iconIndex = e[i + 11];
                    U.zIndex = e[i + 12];
                    U.visible = !0;
                    U.weapons[Number(U.weaponIndex > 8)] = U.weaponIndex;
                    U.variants[U.weaponIndex] = config.weaponVariants[U.weaponVariant];
                    if (U.buildIndex == -1) {
                        U.reloads[U.weaponIndex] = Math.max(0, U.reloads[U.weaponIndex] - oT);
                    }
                    U.shootCount = Math.max(0, U.shootCount - oT);
                    U.inTrap = N.find(z => z.active && z.trap && z.owner.sid != U.sid && !isAlly(U, z.owner.sid) && cdf(U, z) <= 50);
                    doInitPlayers(U);
                    if (U == A) {} else if (A.team && A.team == U.team) {
                        teammates.push(U);
                    } else {
                        enemies.push(U);
                    }
                    players.push(U);
                }
                i += 13;
                Pathfinder.setPos(A.x2, A.y2);
                Tach.setSend(s.send.bind(s));
                Tach.setSelf(A);
                Tach.updatePlayers(X);
            }
            for(let i = 0; i < e.length;) {
                let _ = bn(e[i])
                if(_){
                    preplace2(_)
                }
                i += 13;
            }
            preplace();
            for (let i of items.projFounds) updateProjFounds(i);
            for (let i of fixed) i.run(...i.datas);
            fixed = [];
            let cAB = false;
            let canHammer = A.weapons[1] == 10;
            let iR = A.y2 >= 14400 / 2 - 774 / 2 && A.y2 <= 14400 / 2 + 774 / 2;
            let sAM = [];
            let sAE = [];
            let stopAnothers = false;
            if (players.length) {
                players = players.sort((a, b) => cdf(A, a) - cdf(A, b));
                player = players[0];
            }
            if (teammates.length) {
                teammates = teammates.sort((a, b) => cdf(A, a) - cdf(A, b));
                teammate = teammates[0];
            }
            if (enemies.length) {
                enemies = enemies.sort((a, b) => cdf(A, a) - cdf(A, b));
                enemy = enemies[0];
                enemyAng = Math.atan2(enemy[2]-player.y2, enemy[1]-player.x2)
                for (let i = 0; i < enemies.length; i++) {
                    let U = enemies[i];
                    let dnn;
                    let dist = cdf(A, U);
                    let oldDist = cdf(A, {
                        x: U.x3,
                        y: U.y3
                    });
                    [
                        [U.weapons[0], predicts["7"].primary],
                        [U.weaponIndex, predicts["7"].current]
                    ].forEach(([weapon, array], index) => {
                        if (dist <= 63 + items.weapons[weapon].range) {
                            if (!U.reloads[weapon]) {
                                array.push(U);
                                if (!index && !cAB) {
                                    cAB = [A, U].every((e) => canAntiBull(e));
                                }
                            }
                        }
                    });
                    if (dist <= 63 + items.weapons[U.weaponIndex].range && A.inTrap && A.inTrap.health <= 272.58 && [0, 3, 4, 5].includes(U.weapons[0]) && (3 == U.weapons[0] ? U.variants[3].id >= 1 : true) && cdf(U, A.inTrap) <= 35 * 2 + 52 * 2) {
                        predicts["12"].userTrap.spikeTick.push(U);
                    }
                }
            }
            for (let i = 0; i < N.length; i++) {
                let z = N[i];
                if (predicts["7"].current.length) {
                    if (!A.inTrap) {
                        if (z.active && z.dmg && z.owner.sid != A.sid && !isAlly(A, z.owner.sid) && predicts["7"].current.find(c => utils.getAngleDist(caf(c, A), caf(c, z)) <= toR(z.scale + 35)) && cdf(A, z) <= z.scale + 35 + 50) {
                            sAM.push(z);
                        }
                    }
                    if (z.active && z.dmg && predicts["7"].current.find(c => !c.inTrap && z.owner.sid != c.sid && !isAlly(c, z.owner.sid) && cdf(z, c) <= z.scale + 35 + 50 && utils.getAngleDist(caf(A, c), caf(A, z)) <= toR(z.scale + 35))) {
                        sAE.push(z);
                    }
                }
            }
            function getBreakDmg (_) {
                return Math.round(items.weapons[_.weaponIndex].dmg * (_.skinIndex == 40 ? 3.3 : 1) * r.weaponVariants[_.weaponVariant].val * (_.weaponIndex == 10 ? 7.5 : 1));
            }
            if(A.inTrap && A.inTrap.health < getBreakDmg(A) && cdf(enemy, A) < 300) {
                let interval = setInterval(pf(A.items[4], caf(A, A.inTrap)));
                addFunction(() => {clearInterval(interval)}, 1);
            }
            pathFinder.toggle && pathfinding();
            autoGrind.toggle || j || A.inTrap ? yi(autoGrind.toggle ? oldWeapon : A.inTrap && A.inTrap.health < 20? A.weapons[0] : A.weapons[mI == 2 || A.inTrap ? Number(canHammer) : 0], true) : hitToggle && (watcher--, hitToggle = false, hf(false));
            [...autos, autoOneTick].forEach(e => e.toggle != undefined && e.toDo.length && (e.toggle = false));
            autos.forEach(e => (e.auto ? !j && !A.inTrap : (e.toggle ?? true)) && enemies.forEach(t => {
                !anythingWorks() && e.run(t);
            }));
            for(let i = 0; i < deadPlayer.length; i++){
                let tmpObj = deadPlayer[i]
                if(tmpObj && Date.now() - tmpObj.time >= 4000){
                    deadPlayer.splice(i, 1);
                }
            }
            for(let i = 0; i < objectPredict.length; i++) {
                let _ = objectPredict[i];
                for(let t = 0; t < N.length; t++) {
                    let __ = N[t];
                    if(__ && _ && Math.hypot(__.y - _.y, __.x - _.x) <= _.scale + __.scale && __.active) {
                        objectPredict.splice(i, 1);
                        break;
                    }
                }
                if(Math.hypot(_.y - A.y2, _.x - A.x2) < _.scale || tt.checkItemLocation(_.x,_.y,_.scale,0.6,r.id,false)) {
                    objectPredict.splice(i, 1);
                }
                if(_ && Date.now() - _.time >= 4000) {
                    objectPredict.splice(i, 1);
                }
            }
            if (queueTick[tick]) {
                queueTick[tick].forEach(e => e());
            }
            findSpikeHit.x = 0;
            findSpikeHit.y = 0;
            doSpikeHit()
            preplace()
            enemy && !anythingWorks() && autoOneTick.run(enemy);
            autoPlacer.count++;
            if (autoMill.toggle) {
                if (cdf(A, autoMill) > l.list[A.items[3]].scale * 2) {
                    let n = caf({
                        x: A.x1,
                        y: A.y1
                    }, A) + Math.PI;
                    pf(A.items[3], n - 72 * Math.PI / 180);
                    pf(A.items[3], n);
                    pf(A.items[3], n + 72 * Math.PI / 180);
                    autoMill.x = A.x2;
                    autoMill.y = A.y2;
                }
            } else if (enemies.length && !A.inTrap) {
                if (autoPlacer.toggle) {
                    autoPlacer.count = 0;
                    if (true) {
                        if (A.inTrap) {
                            let ignore = 0;
                            let toTrap = caf(A, A.inTrap);
                            let farFromEnemy = cdf(A, enemy);
                            for (let i = 0; i < Math.PI * 2; i += Math.PI / 6) {
                                if (ignore) {
                                    ignore--;
                                } else {
                                    if (pf(farFromEnemy <= 300 ? A.items[2] : A.items[4], toTrap + i)) {
                                        ignore = Math.ceil(farFromEnemy <= 300 ? items.list[A.items[2]].scale : 50 / Math.PI / 6);
                                    }
                                }
                            }
                        } else if (enemy.inTrap && !A.inTrap) {
                            let toTrap = caf(A, enemy.inTrap);
                            let farFromTrap = cdf(A, enemy.inTrap);
                            if (farFromTrap <= 50 + items.list[A.items[2]].scale) {
                                let ignore = 0;
                                pf(A.items[4], toTrap);
                                for (let i = 0; i < Math.PI; i += Math.PI / 6) {
                                    if (ignore) {
                                        ignore--;
                                    } else {
                                        if (pf(A.items[2], toTrap + Math.PI / 2 + i)) {
                                            ignore = Math.ceil(items.list[A.items[2]].scale / Math.PI / 6);
                                        }
                                    }
                                }
                            } else if (farFromTrap <= 50 + 35 * 2 + items.list[A.items[2]].scale) {
                                let ignore = [0, 0];
                                let delta = 90 * (1 - (farFromTrap - 50 - items.list[A.items[2]].scale) / 70);
                                for (let i = 0; i < toR(items.list[A.items[2]].scale); i += toR(items.list[A.items[2]].scale) / 4) {
                                    let _i = i + toR(delta);
                                    let placed;
                                    if (ignore[0]) {
                                        placed = false;
                                        ignore[0]--;
                                    } else {
                                        if (pf(A.items[2], toTrap + _i)) {
                                            if (toD(_i) < items.list[A.items[2]].scale) {
                                                ignore[0] = Math.ceil(items.list[A.items[2]].scale / items.list[A.items[2]].scale / 4);
                                            }
                                            placed = true;
                                        }
                                    }
                                    if (placed) {
                                        ignore[0] = Math.ceil(items.list[A.items[2]].scale / items.list[A.items[2]].scale / 4);
                                    }
                                    if (!placed || utils.getAngleDist(toTrap + _i, toTrap - _i) > toR(items.list[A.items[2]].scale)) {
                                        if (ignore[1]) {
                                            ignore[1]--;
                                        } else {
                                            if (pf(A.items[2], toTrap - _i)) {
                                                ignore[1] = Math.ceil(items.list[A.items[2]].scale / items.list[A.items[2]].scale / 4);
                                            }
                                        }
                                    }
                                }
                            } else {
                                for(let i = 0;i<12;i++) {
                                    pf(A.items[4], i * Math.PI/6);
                                }
                            }
                        } else {
                            /*let toEnemy = cdf(A, enemy);
                            let farFromEnemy = cdf(A, enemy);
                            let ignore = 0;
                            for (let i = 0; i < Math.PI * 2; i += Math.PI / 6) {
                                if (ignore) {
                                    ignore--;
                                } else {
                                    if (pf(A.items[4], toEnemy + i)) {
                                        ignore = Math.ceil(50 / Math.PI / 6);
                                    }
                                }
                            }*/
                            for(let i = 0;i<12;i++) {
                                pf(A.items[4], i * Math.PI/6);
                            }
                        }
                    }
                }
            }
            for (let e of [...autos, autoOneTick]) {
                if (e.toDo.length) {
                    e.toDo.pop()();
                    stopAnothers = true;
                    break;
                }
            }
            let spikes = N.some(e => {
                if(e.name && e.active && /spik/.test(e.name) && Math.hypot(e.y - A.y2, e.x - A.x2) < 180 && e.owner.sid != A.sid && (A.team ? !isAlly(e.owner.sid) : 1)) {
                    return true;
                }
                return false;
            });
            if (!stopAnothers) {
                if ((autoGrind.toggle || j || A.inTrap) && !A.reloads[oldWeapon]) {
                    if (!hitToggle) {
                        hitToggle = true;
                        watcher++;
                        hf(true);
                    }
                    if (A.inTrap) {
                        let spikes = N.some(e => {
                            if(e.name && e.active && /spik/.test(e.name) && Math.hypot(e.y - A.y2, e.x - A.x2) < 222 && e.owner.sid != A.sid && (A.team ? !isAlly(e.owner.sid) : 1)) {
                                return true;
                            }
                            return false;
                        });
                        scriptMode = "autoBreak";
                        ef(40, 0);
                        ef(18, 1);
                        wf(autoInstakill.toDo.length?enemyAng:spikes?angle360:caf(A.inTrap, A)+Math.PI);
                    } else if (autoGrind.toggle) {
                        ef(40, 0);
                        ef(21, 1);
                        for (let i=0; i<4; i++){
                            pf(A.items[5], Math.PI/2*i);
                        }
                        wf(90**100);
                    } else if (mI == 2) {
                        scriptMode = "tankClick";
                        ef(40, 0);
                        ef(21, 1);
                        wf(angle360);
                    } else {
                        scriptMode = mI == 1 ? "plagueClick" : "bullClick";
                        yi(A.weapons[0], true);
                        ef(mI == 1 ? 21 : 7, 0);
                        ef(A.tails[21] ? 21 : 0, 1);
                        wf(angle360);
                    }
                } else {
                    if (!A.inTrap && !doingTS && !autoHitToggle) {
                        if(A.weapons[1] == 10){
                            if (A.reloads[A.weapons[1]]) {
                                yi(A.weapons[1], true);//reload
                            } else if (A.reloads[A.weapons[0]]) {
                                yi(A.weapons[0], true);
                            }
                        } else {
                            if (A.reloads[A.weapons[1]]) {
                                yi(A.weapons[1], true);//reload
                            } else if (!A.reloads[A.weapons[1]]) {
                                yi(A.weapons[0], true);
                            }
                        }
                    }
                    if (!autoOneTick.stopHatting && Qe.style.display != "block") {
                        if (A.skinIndex !== 45 && A.shameCount && ((tick - lastBullBleed) % 9 == 0 || startBullBleed)) {
                            startBullBleed++;
                            ef(7, 0);
                            ef(11, 1);
                        } else if (iR) {
                            ef(31, 0);
                            ef(11, 1);
                        } else if (A.inTrap) {
                            if (predicts["7"].primary.length && cAB && A.inTrap.health > getBreakDmg(A)) {
                                ef(perma ? 6 : 11, 0);
                                ef(21, 1);
                            } else if (predicts["7"].current.length) {
                                ef(perma ? 6 : 26, 0);
                                ef(21, 1);
                            } else {
                                ef(6, 0);
                                ef(21, 1);
                            }
                        } else if (predicts["7"].current.length && (sAE.length || sAM.length)) {
                            ef(perma ? 6 : 26, 0);
                            ef(predicts["7"].primary.length ? 21 : 11, 1);
                        } else if (predicts["7"].primary.length && cAB) {
                            ef(perma ? 6 : 11, 0);
                            ef(perma ? 6 : 21, 1);
                        } else if(scriptMode == "tankClick"){
                            ef(6, 0);
                            ef(spikes?0:11, 1);
                        } else if (enemies.length && cdf(A, enemy) < 300) {
                            ef(6, 0);
                            ef(predicts["7"].primary.length ? 21 : 11, 1);
                        } else if (A.y2 <= 2400) {
                            ef(15, 0);
                            ef(11, 1);
                        } else {
                            ef(perma ? 6 : 12, 0);
                            ef(11, 1);
                        }
                    }
                    if (!watcher) {
                        wf(ci());
                    }
                }
            }
            informationMenu.innerHTML = `
                        <div style="font-size: 14px;">
                        Ping: ${window.pingTime}<br>
                        Auto-Insta: ${autoInstakill.toggle}<br>
                        Auto-OneTick: ${autoOneTick.toggle}<br>
                        Auto-Grind: ${autoGrind.toggle}<br>
                        Auto-Mill: ${autoMill.toggle}<br>
                        </div>`;
            items.projFounds = [];
        }
        let antiReverseInsta = function(sid, datas) {
            if (U = findP(sid)) {
                if (A != U && !It.includes(U.sid) && cdf(A, U) < 300 && !U.reloads[U.weapons[0]]) {
                    if (A.shameCount <= 5) {
                        //cf("reverse insta detect test");
                        for (let v = 0; v < 5; v++) pf(A.items[0]);
                    }
                }
            }
        }

        function updateProjFounds(e) {
            let weapon = e[5] == 0 ? 9 : e[5] == 2 ? 12 : e[5] == 3 ? 13 : e[5] == 5 && (15);
            let projectile = Y.find(z => z.sid == e[7]);
            for (let c = 0; c < players.length; c++) {
                if (U = players[c]) {
                    if (U.visible && (e[5] == 1 ? U.skinIndex == 53 : U.weaponIndex == weapon) && utils.getAngleDist(caf(U, {
                        x: e[0],
                        y: e[1],
                    }), U.d2) <= Math.PI / 2.6 && cdf(U, {
                        x: e[0] - Math.cos(e[2]) * 35,
                        y: e[1] - Math.sin(e[2]) * 35,
                    }) <= 70) {
                        if (e[5] == 1) U.shootCount = 2500;
                        else U.reloads[weapon] = l.weapons[weapon].speed;
                        projectile.owner = U;
                        if (A != U && !It.includes(U.sid)) {
                            antiReverseInsta(U.sid, e);
                        }
                    }
                }
            }
        }
        var informationMenu = Object.assign(document.createElement("div"), {
            id: "informationMenu",
            borderRadius: "4px",
            textAlign: "left",
        });
        Object.assign(informationMenu.style, {
            position: "absolute",
            color: "white",
            width: "120px",
            height: "326px",
            top: "140px",
            right: "20px"
        });
        document.getElementById("gameUI").appendChild(informationMenu);
        informationMenu.style.display = "block";

        function getElement(e) {
            return document.getElementById(e)
        }
        let doingTS = false;

        function ticksync() {
            doingTS = true;
            let dir = caf(A, enemy);
            ef(53, 0);
            yi(A.weapons[1], true);
            wf(dir);
            hf(true);
            setTimeout(() => {
                doingTS = false
                hf(false);
            }, 90)
        }
        function pfc (e) {
            Tach.updateChat(e, A.sid);
        }
        let sliderDisplay5 = document.createElement("div");
        sliderDisplay5.id = "menu5",
            document.body.prepend(sliderDisplay5),
            document.getElementById("menu5").style.position = "absolute",
            document.getElementById("menu5").style.display = "block",
            document.getElementById("menu5").style.width = "400px",
            document.getElementById("menu5").style.height = "190px",
            document.getElementById("menu5").style.left = "20px",
            document.getElementById("menu5").style.top = "20px",
            document.getElementById("menu5").style.padding = "10px",
            document.getElementById("menu5").style.color = "#ffffff",
            document.getElementById("menu5").style.borderRadius = "3px",
            document.getElementById("menu5").style.backgroundColor = "rgb(0,0,0,.25)",
            document.getElementById("menu5").innerHTML = `
            <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dosis:wght@200..800&family=Matemasie&display=swap" rel="stylesheet">
            <style>
            * {
            font-family: "Dosis", sans-serif;
            }
            </style>
    <div id="helpText" style="font-size: 30px;color: rgb(255, 255, 255);">SACI XI: <br>\n
    <div id="c3" style="color: #fff; font-size: 12px; overflow-y: scroll; max-height: 150px;">
    <label>---------- Settings: ----------</label>
    <br>
    <br>
    <label class = "indent">AutoGrind: </label><button id="atg">Disabled</button>
    <br>
    <label class = "indent">AutoPlacer: </label><button id="atp">Enabled</button>
    <br>
    <label class = "indent">Perm Soldier: </label><button id="atps">Disabled</button>
    <br>
    <label class = "indent">AutoChatSync: </label><select name="songs" id="songs">
        <option value="Rival - Walls" selected>Rival-Walls</option>
        <option value="Rival - Be Gone">Rival-BeGone</option>
        <option value="Rival - Lonely Way">Rival-LonelWay</option>
        <option value="Rival - Throne">Rival-Throne</option>
        <option value="Rival - Control">Rival-Control</option>
        <option value="Ezgod - No Rival">Ezgod-NoRival</option>
        <option value="do not resurrect - Necrotic Grip">DNR-NecroticGrip</option>
        <option value="Witchouse 40k - Black Rainbow">Witchouse40k-BlackRainbow</option>
        <option value="Grim Salvo - Feasting.On.The.Guts.Of.Angels">GrimSalvo-FOTGOA</option>
        <option value="Initial D - Don't Stand so Close">InitialD-DontStandSoClose</option>
        <option value="Initial D - The Top">InitialD-TheTop</option>
        <option value="Initial D - Gas Gas Gas">InitialD-GasGasGas</option>
        <option value="Initial D - Running In The 90's">InitialD-RunningInThe90s</option>
        <option value="Initial D - No One Sleep In Tokyo">InitialD-NoOneSleepInTokyo</option>
        <option value="UNSECRET & Noeni - Fallout">UNSECRET-Fallout</option>
        <option value="V O E - Giants">VOE-Giants</option>
        <option value="Neoni - Champion">Neoni-Champion</option>
        <option value="JPB & Mendum - Losing Control">Mendum-LosingControl</option>
        <option value="Freddie Dredd - Limbo">FreddieDredd-Limbo</option>
        <option value="Adrenaline - ACE">Adrenaline-ACE</option>
        </select>
        <br>
        <label> Toggle chat sync on "c" </label>
        <br>
        <br>
        <label>---------- Visuals & Non-essentials: ----------</label>
        <br>
        <br>
        <label class = "indent">Shadow Mode: </label><button id="sha">Disabled</button>
        <br>
        <label class = "indent">Night Mode: </label><button id="nit">Disabled</button>
        <br>
        <label class = "indent">Break Numbers: </label><button id="bnum">Disabled</button>
        <br>
        <label class = "indent">Trap Radar (show all the traps you placed): </label><button id="str">Disabled</button>
        <br>
        <label class = "indent">Free Aim: </label><button id="fra">Disabled</button>
        <br>
        <label class = "indent">Visual Mode: <span id="vim">none</span> </label><button id="vis">Disabled</button>
        <br>
        <br>
        <label>---------- Path Finder: ----------</label>
        <br>
        <br>
        <label class = "indent">Path Type: </label>
        <select name="pathTypes" id="pathTypes">
        <option value="none" selected> - </option>
        <option value="goto">[goal/goto] [x: Number] [y: Number]</option>
        <option value="wander">[wander]</option>
        <option value="enemy">[gotoEnemy]</option>
        <option value="followP">[follow] player <[ID/Name: Any]/all(default)></option>
        <option value="followA">[follow] animal <[ID/Name: Any]/all(default)></option>
        </select>
        <div id="pathTab">
        </div>
    </div>
    </div>
                              `
        let vism = {
            toggle: false,
            beta: false,
        }
        let nite = true;
        let bnum = true;

        function addButton(id, item) {
            if (item) {
                getElement(id).innerHTML = "Enabled"
            } else {
                getElement(id).innerHTML = "Disabled"
            }
        }
        getElement("vim").onclick = function() {
            vism.beta = !vism.beta
        }
        getElement("atg").onclick = function() {
            autoGrind.toggle = !autoGrind.toggle
        }
        getElement("sha").onclick = function() {
            shadowMode = !shadowMode
        }
        getElement("nit").onclick = function() {
            nite = !nite
        }
        getElement("bnum").onclick = function() {
            bnum = !bnum
        }
        getElement("str").onclick = function() {
            showTrapRadar = !showTrapRadar
        }
        getElement("atp").onclick = function() {
            autoPlacer.toggle = !autoPlacer.toggle
        }
        getElement("atps").onclick = function() {
            perma = !perma
        }
        getElement("fra").onclick = function() {
            freA = !freA
        }
        getElement("vis").onclick = function() {
            vism.toggle = !vism.toggle
        }
        let lastAction = "stop";
        function setPathHtml () {
            let pathType = document.getElementById("pathTypes").value;
            pfc("stop");
            lastAction = "stop";
            if(pathType == "goto"){
                let pathTab = document.getElementById("pathTab")
                pathTab.innerHTML = `
                <label class = "indent">X: </label><input id="goto-x" autocomplete="off" type="input" maxlength="5"></input><br>
                <label class = "indent">Y: </label><input id="goto-y" autocomplete="off" type="input" maxlength="5"></input><br>
                <button id="path">Start</button>
                `;
                let gotoX = document.getElementById("goto-x"), gotoY = document.getElementById("goto-y"), startPath = document.getElementById("path");
                startPath.onclick = function(){
                    if(lastAction == "stop" && gotoX.value && gotoY.value){
                        pfc(`goto ${gotoX.value} ${gotoY.value}`);
                        lastAction = "start";
                        startPath.innerHTML = "stop"
                    } else {
                        startPath.innerHTML = "start"
                        lastAction = "stop";
                        pfc("stop")
                    }
                }
            } else if(pathType == "wander"){
                let pathTab = document.getElementById("pathTab")
                pathTab.innerHTML = `
                <button id="path">Start Wander</button>
                `;
                let startPath = document.getElementById("path")
                startPath.onclick = function(){
                    if(lastAction == "stop"){
                        pfc(`wander`);
                        lastAction = "start";
                        startPath.innerHTML = "Stop Wander"
                    } else {
                        startPath.innerHTML = "Start Wander"
                        lastAction = "stop";
                        pfc("stop")
                    }
                }
            } else if(pathType == "enemy") {
                let pathTab = document.getElementById("pathTab")
                pathTab.innerHTML = `
                <button id="path">Start Path</button>
                `;
                let startPath = document.getElementById("path");
                startPath.onclick = function(){
                    function getPlayers () {
                        let tmpEnemyMap = [];
                        for (let t = 0; t < bt.length;) {
                            let dist = Math.hypot(bt[t+1] - A.y2, bt[t] - A.x2);
                            tmpEnemyMap.push({x: bt[t], y: bt[t+1], dist: dist})
                            t += 2
                        }
                        let sortedTmpEnemyMap = [...tmpEnemyMap].sort((a, b) => a.dist - b.dist);
                        return sortedTmpEnemyMap[0];
                    }
                    if(lastAction == "stop" && bt.length){
                        pfc(`goto ${getPlayers().x} ${getPlayers().y}`);
                        lastAction = "start";
                        startPath.innerHTML = "Stop Path";
                    } else {
                        startPath.innerHTML = "Start Path";
                        lastAction = "stop";
                        pfc("stop")
                    }
                }
            } else if(pathType == "followP") {
                let pathTab = document.getElementById("pathTab")
                pathTab.innerHTML = `
                <label class = "indent">Name/ID: </label><input id="nameid" autocomplete="off" type="input" maxlength="10"></input><br>
                <button id="path">Start</button>
                `;
                let nameId = document.getElementById("nameid"), startPath = document.getElementById("path");
                startPath.onclick = function(){
                    if(lastAction == "stop" && nameId.value){
                        pfc(`follow player ${nameId.value}`);
                        lastAction = "start";
                        startPath.innerHTML = "stop"
                    } else {
                        startPath.innerHTML = "start"
                        lastAction = "stop";
                        pfc("stop")
                    }
                }
            } else if(pathType == "followA") {
                let pathTab = document.getElementById("pathTab")
                pathTab.innerHTML = `
                <label class = "indent">Animal Name/ID: </label><input id="nameid" autocomplete="off" type="input" maxlength="10"></input><br>
                <button id="path">Start</button>
                `;
                let nameId = document.getElementById("nameid"), startPath = document.getElementById("path");
                startPath.onclick = function(){
                    if(lastAction == "stop" && nameId.value){
                        pfc(`follow animal ${nameId.value}`);
                        lastAction = "start";
                        startPath.innerHTML = "stop"
                    } else {
                        startPath.innerHTML = "start"
                        lastAction = "stop";
                        pfc("stop")
                    }
                }
            }
        }
        document.getElementById("pathTypes").addEventListener('change', function() {
            setPathHtml ()
        });
        setInterval(() => {
            if (!vism.toggle) {
                document.getElementById("vim").innerHTML = "none"
                document.getElementById("vim").style.color = "#fff"
            } else {
                if (vism.beta) {
                    document.getElementById("vim").style.color = "#80ada8"
                    document.getElementById("vim").innerHTML = "old ae86"
                } else {
                    document.getElementById("vim").style.color = "#bababa"
                    document.getElementById("vim").innerHTML = "plain"
                }
            }
            if(enemy && document.getElementById("pathTypes").value == "enemy" && lastAction !== "stop"){
                pfc("stop")
            } else if(document.getElementById("pathTypes").value == "enemy" && lastAction !== "stop"){
                function getPlayers () {
                    let tmpEnemyMap = [];
                    for (let t = 0; t < bt.length;) {
                        let dist = Math.hypot(bt[t+1] - A.y2, bt[t] - A.x2);
                        tmpEnemyMap.push({x: bt[t], y: bt[t+1], dist: dist})
                        t += 2
                    }
                    console.log(tmpEnemyMap)
                    let sortedTmpEnemyMap = [...tmpEnemyMap].sort((a, b) => a.dist - b.dist);
                    return sortedTmpEnemyMap[0];
                }
                if(bt.length){
                    pfc(`goto ${getPlayers().x} ${getPlayers().y}`);
                    lastAction = "start";
                } else {
                    pfc("stop")
                    lastAction = "stop";
                    document.getElementById("path").innerHTML = "Start Path"
                }
            }
            placer.toggle && (pf(A.items[placer.itemIndex], ci()));
            addButton("atg", autoGrind.toggle)
            addButton("sha", shadowMode)
            addButton("nit", nite)
            addButton("bnum", bnum)
            addButton("str", showTrapRadar)
            addButton("atp", autoPlacer.toggle)
            addButton("atps", perma)
            addButton("fra", freA)
            addButton("vis", vism.toggle)
            manageUI ()
        })
        function manageUI () {
            let $ = window.$
            let UI = [
                ['leaderboard', {'top': '20px', 'left': '20px', 'position': 'fixed'}],
                ['killCounter', {'right': '20px', 'top': '80px', 'position': 'fixed'}],
                ['scoreDisplay', {'background-position': 'right 6px center', 'padding-left': '10px', 'padding-right': '40px', 'left': 'inherit', 'right': '20px', 'bottom': '185px', 'position': 'fixed'}],
                ['itemInfoHolder', {'opacity': '0'}],
                ['allianceButton', {'right': '20px'}],
                ['storeButton', {'right': '80px'}],
                ['chatButton', {'right': '140px'}],
            ];
            for (let t = 0; t < UI.length; t++) {
                let s = UI[t][0],
                    l = UI[t][1];
                $("#" + s).css(l)
            }
        }
        function cdf(e, t) {
            try {
                return Math.hypot((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
            } catch (e) {
                return Infinity;
            }
        }

        function caf(e, t) {
            try {
                return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
            } catch (e) {
                return 0;
            }
        }

        function numArr(e = 0, t = 1, act, n = 1) {
            let arr = [];
            for (let i = e; i < t; i += n) {
                arr.push(i);
                typeof act == "function" && act(i);
            }
            return arr;
        }

        function rand(e = 1, t = 2) {
            return Math.random() * (t - e) + e;
        }

        function pathfinding() {
            let dist = cdf(A, pathFinder);
            let dir = caf(A, pathFinder);
            if (dist < 100) {
                pathFinder.toggle = false;
                mf(undefined);
            } else {
                let movee = canMove(A, {
                    x: A.x2 + Math.cos(dir) * 70,
                    y: A.y2 + Math.sin(dir) * 70,
                });
                if (movee == true) {
                    mf(dir);
                } else if (movee == false) {
                    console.alert("Path finder bugged");
                } else {
                    for (let i = 0; i < 90; i += 10) {
                        let ii = toR(movee.scale + 35 + i);
                        let _movee = canMove(A, {
                            x: A.x2 + Math.cos(dir + ii) * 70,
                            y: A.y2 + Math.sin(dir + ii) * 70,
                        });
                        if (_movee == true || canMove(A, {
                            x: A.x2 + Math.cos(dir - ii) * 70,
                            y: A.y2 + Math.sin(dir - ii) * 70,
                        }) == true) {
                            mf(_movee == true ? ii : -ii);
                            break;
                        } else {
                            mf(undefined);
                            break;
                        }
                    }
                }
            }
        }

        function isAlly(e, t) {
            t = typeof t == "number" ? bn(t) || {
                sid: t,
                visible: false
            } : t;
            if (e == A || It.includes(t.sid)) {
                return It.includes(t.sid);
            } else if (e.visible && t.visible) {
                return e.team && e.team == t.team;
            }
        }

        function canAntiBull(e) {
            return [3, 4, 5].includes(e.weapons[0]) && (3 == e.weapons[0] ? e.variants[3].id >= 2 : true);
        }

        function updC(e, t) {}

        function checkElement(e) {
            return null !== e.offsetParent
        }

        function toR(e) {
            var n = (e * Math.PI / 180) % (2 * Math.PI);
            return n > Math.PI ? Math.PI - n : n
        }

        function toD(e) {
            var n = (e / Math.PI * 360) % 360;
            return n >= 360 ? n - 360 : n;
        }

        function canMove(e, t) {
            if (!e) return false;
            if (!t) return false;
            let dist = cdf(e, t);
            let dir = caf(e, t);
            let tmpList = N.filter(n => n.active && cdf(e, n) - n.scale <= dist &&
                                   utils.getAngleDist(dir, caf(e, n)) <= toR(n.getScale()) &&
                                   !e.ignoreCollision);
            if (tmpList.length > 0) {
                for (let tmpObj of tmpList) {
                    let tmpDist = cdf(e, tmpObj);
                    let tmpDir = caf(e, tmpObj);
                    let x = e.x2 + Math.cos(dir) * tmpDist,
                        y = e.y2 + Math.sin(dir) * tmpDist;
                    if (utils.lineInRect(tmpObj.x - tmpObj.scale,
                                         tmpObj.y - tmpObj.scale,
                                         tmpObj.x + tmpObj.scale,
                                         tmpObj.y + tmpObj.scale,
                                         x, y, x, y)) {
                        return tmpObj;
                    }
                }
            }
            return true;
        }

        function toggleSing() {
            singing.toggle = !singing.toggle;
            singing.timeouts.forEach(e => clearTimeout(e));
            singing.timeouts = [];
            let song = songs.find(e => e.name == singing.name);
            if (singing.toggle && singing.audio) {
                singing.audaddcommandonended = function() {
                    singing.toggle = false;
                    singing.audaddcommandcurrentTime = 0;
                    singing.audaddcommandpause()
                };
                singing.audaddcommandplay();
                for (let time in song.sync) {
                    let message = song.sync[time];
                    singing.timeouts.push(setTimeout(() => {
                        cf(message ?? "");
                    }, time));
                }
            } else {
                singing.audio && (singing.audaddcommandcurrentTime = 0, singing.audaddcommandpause());
            }
        }
        var songs = [{
            name: "Rival - Walls",
            src: "",
            sync: {
                "::": "I was ready to surrender",
                "::": "my heart to you",
                "::": "only you",
                "::": "These lights",
                "::": "all around me keep",
                "::": "blinding my eyes from you",
                "::": "and the truth",
                "::": "Don't tell me",
                "::": "don’t tell",
                "::": "me",
                "::": "don't tell me why",
                "::": "I know",
                "::": "I know no you won't",
                "::": "save my life",
                "::": "save my life",
                "::": "If you keep on",
                "::": "you keep",
                "::": "on you making the waves",
                "::": "You and I will never be sane",
                "::": "be sane",
                "::": "If these walls come down",
                "::": "Will you pick me",
                "::": "off the ground",
                "::": "If these walls come down",
                "::": "Will you save me",
                "::": "or burn me down",
                "::": "I was ready to surrender",
                "::": "my heart to you",
                "::": "only you",
                "::": "These lights",
                "::": "all around me keep",
                "::": "blinding my eyes from you",
                "::": "and the truth",
                "::": "Don’t tell me",
                "::": "don't tell",
                "::": "me",
                "::": "don't tell me why",
                "::": "I know",
                "::": "I know no you won't",
                "::": "save my life",
                "::": "save my life",
                "::": "If you keep on",
                "::": "you keep",
                "::": "on you making the waves",
                "::": "You and I will never be sane",
                "::": "be sane",
                "::": "If these walls come down",
                "::": "Will you pick me",
                "::": "off the ground",
                "::": "If these walls come down",
                "::": "Will you save me",
                "::": "or burn me down",
            },
        }, {
            name: "Rival - Be Gone",
            src: "",
            sync: {
                "::": "You",
                "::": "you just walk right",
                "::": "out the door",
                "::": "Don’t wanna do this anymore",
                "::": "Now I’m lost without you",
                "::": "You",
                "::": "drive me crazy out my mind",
                "::": "How’d you do this every time?",
                "::": "Now I’m lost without you",
                "::": "Used to be the one",
                "::": "I talk to when I’m sad",
                "::": "Can’t you see",
                "::": "now tainted love is",
                "::": "all we have?",
                "::": "Our issues run so deep",
                "::": "Now when I try to",
                "::": "sleep I feel so bad",
                "::": "I should leave",
                "::": "and by the time it’s dawn",
                "::": "I’ll be gone",
                "::": "I should leave",
                "::": "and by the time it’s dawn",
                "::": "I’ll be gone",
                "::": "You’re",
                "::": "so distant when you’re home",
                "::": "Always hanging by your phone",
                "::": "Do I even know you?",
                "::": "And I",
                "::": "get paranoid sometimes",
                "::": "‘Cause I know that",
                "::": "you ain’t mine",
                "::": "And I’m lost without you",
                "::": "Used to be the one",
                "::": "I talk to when I’m sad",
                "::": "Can’t you see",
                "::": "now tainted love is",
                "::": "all we have?",
                "::": "Our issues run so deep",
                "::": "Now when I try to",
                "::": "sleep I feel so bad",
                "::": "I should leave",
                "::": "and by the time it’s dawn",
                "::": "I’ll be gone",
                "::": "I’ll be gone",
            },
        }, {
            name: "Rival - Lonely Way",
            src: "",
            sync: {
                "::": "I don't wanna fight anymore",
                "::": "Just turn around",
                "::": "and leave me",
                "::": "The tear in my eye",
                "::": "drops on the floor",
                "::": "Alongside my spear",
                "::": "My knees are drenched in",
                "::": "In the blood",
                "::": "I've spilled just to get here",
                "::": "When I look around me",
                "::": "Everything",
                "::": "I had went up in flames",
                "::": "My lonely way",
                "::": "When I look around me",
                "::": "Everything",
                "::": "I had went up in flames",
                "::": "My lonely way",
                "::": "I never pray to God anymore",
                "::": "I'd rather no one heard me",
                "::": "Redemption",
                "::": "I have waited for you to come",
                "::": "And drown all my sins",
                "::": "My knees are drenched in",
                "::": "In the blood",
                "::": "I've spilled just to get here",
                "::": "When I look around me",
                "::": "Everything",
                "::": "I had went up in flames",
                "::": "(My lonely way)",
            },
        }, {
            name: "Rival - Throne",
            src: "",
            sync: {
                "::": "So you wanna go to war with me",
                "::": "You're talking like",
                "::": "you think you're royalty",
                "::": "You think that I'm afraid",
                "::": "But I don't break",
                "::": "I heard you question",
                "::": "my stability",
                "::": "You think I'll fall",
                "::": "just like a guillotine",
                "::": "But I am here to stay",
                "::": "Won't look away",
                "::": "A storm is coming",
                "::": "So you best start running",
                "::": "No",
                "::": "you can't control",
                "::": "feel it in my bones",
                "::": "I'm coming for the-",
                "::": "Coming for the-",
                "::": "Oh-oh, oh-oh-ohv",
                "::": "Oh-oh, oh-oh-oh",
                "::": "Oh-oh, oh-oh-oh",
                "::": "I'm coming for the throne",
                "::": "I'm coming for the throne",
                "::": "Mh-mh, mh-mh-mh",
                "::": "Mh-mh, mh-mh-mh",
                "::": "Mh-mh, mh-mh-mh, mh-mh-mh",
                "::": "So you wanna be my enemy",
                "::": "You should have known",
                "::": "I'd never kiss the ring",
                "::": "Ice runs in my veins",
                "::": "Won't play it safe",
                "::": "I don't belong",
                "::": "with your nobility",
                "::": "Who died and",
                "::": "made you king of anything?",
                "::": "You think that I'm insane",
                "::": "That's your mistake",
                "::": "Kingdoms rise and fall",
                "::": "I've come to take it all",
                "::": "I'll take it",
                "::": "I've come to take it",
                "::": "Kingdoms rise and fall",
                "::": "I've come to take it all",
                "::": "I'll take it all",
                "::": "The storm is coming",
                "::": "So you best start running",
                "::": "No, you can't control",
                "::": "feel it in my bones",
                "::": "I'm coming for the",
                "::": "coming for the",
                "::": "Oh-oh, oh-oh-oh",
                "::": "Oh-oh, oh-oh-oh",
                "::": "Oh-oh, oh-oh-oh",
                "::": "I'm coming for the throne",
                "::": "I'm coming for the throne",
                "::": "Mh-mh, mh-mh-mh",
                "::": "Mh-mh, mh-mh-mh",
                "::": "Mh-mh, mh-mh-mh, mh-mh-mh",
                "::": "Oh-oh, oh-oh-oh",
                "::": "Oh-oh, oh-oh-oh",
                "::": "Oh-oh, oh-oh-oh, oh-oh-oh",
            },
        }, {
            name: "Rival - Control",
            src: "",
            sync: {
                "::": "Take me in the smoke",
                "::": "Breathe me in and let me go",
                "::": "Filling the lungs inside you",
                "::": "In the black of night",
                "::": "Make my way into your mind",
                "::": "Just to know what you knew",
                "::": "Restless every time",
                "::": "We start lockin' eyes",
                "::": "Oh, oh, oh, oh",
                "::": "Lost control",
                "::": "Oh",
                "::": "it's paradise",
                "::": "With a nasty bite",
                "::": "Oh, oh, oh, oh",
                "::": "In the dead of the night",
                "::": "Let the darkness take control",
                "::": "Let the darkness take control",
                "::": "Darkness take control",
                "::": "May the darkness take control",
                "::": "Take me in the smoke",
                "::": "Breathe me in and let me go",
                "::": "Sink to your heart to find you",
                "::": "Open up your eyes",
                "::": "till you're blinded",
                "::": "by the lies",
                "::": "So you can see what you do",
                "::": "Restless every time",
                "::": "We start lockin' eyes",
                "::": "Oh, oh, oh, oh",
                "::": "Lost control",
                "::": "Oh",
                "::": "it's paradise",
                "::": "With a nasty bite",
                "::": "Oh, oh, oh, oh",
                "::": "In the dead of the night",
                "::": "Teardrops on the floor",
                "::": "The pain is over",
                "::": "Feel the darkness take control",
                "::": "May the darkness take control",
            },
        }, {
            name: "Egzod - No Rival",
            src: "https://cdn.discordapp.com/attachments/1059159650026659842/1075173234263203861/Egzod_Maestro_Chives_Alaina_Cross_-_No_Rival_NCS_Release.mp3?ex=66bbd61a&is=66ba849a&hm=9c4bc169740c895cbfa0f1a3e4fc271a21984b8fb9ef32671430fc9a3a5b960d&",
            sync: {
                "12:679": "Here and now",
                "13:730": "you're coming up to me",
                "15:197": "'Fore I'm lighting up the sky",
                "18:565": "Feel the ground",
                "19:855": "shaking underneath",
                "21:346": "Tryna take me alive",
                "24:415": "Oh-oh-oh-oh-oh-oh-oh",
                "26:906": "Get ready for the fallout",
                "30:357": "Oh-oh-oh-oh-oh-oh-oh",
                "33:26": "Can't stop me now",
                "35:154": "I got no rival",
                "37:463": "I'ma find my way",
                "39:615": "Through the blood and pain",
                "41:162": "Game of survival",
                "43:463": "Any time or place",
                "45:577": "Watch 'em run away",
                "47:337": "I got no-",
                "49:78": "I'll be standing on my own",
                "51:259": "Never gonna take my thrown",
                "53:389": "I got no rival",
                "55:349": "Watch 'em run away",
                "57:320": "I got no, no, no",
                "58:789": "I got no, no, no rival",
                "1:0:227": "No rival",
                "1:11:329": "No rival",
                "1:17:295": "No Rival",
                "1:24:694": "Tell them now what you gon' do",
                "1:27:265": "We can do this face-to-face",
                "1:30:316": "Reckoning is coming real soon",
                "1:33:254": "Doesn't matter what you say",
                "1:36:175": "Tryna tell you",
                "1:37:203": "listen to the moment",
                "1:38:512": "Can't take mine 'cause I own it",
                "1:42:714": "Don't you know that",
                "1:43:869": "I'm locked and I'm loaded?",
                "1:45:389": "You're out of focus",
                "1:48:202": "Oh-oh-oh-oh-oh-oh-oh",
                "1:51:61": "Get ready for the fallout",
                "1:54:362": "Oh-oh-oh-oh-oh-oh-oh",
                "1:56:885": "Can't stop me now",
                "1:59:205": "I got no rival",
                "2:1:383": "I'ma find my way",
                "2:3:722": "Through the blood and pain",
                "2:5:242": "Game of survival",
                "2:7:461": "Any time or place",
                "2:9:631": "Watch 'em run away",
                "2:11:210": "I got no-",
                "2:12:959": "I'll be standing on my own",
                "2:15:221": "Never gonna take my throne",
                "2:17:141": "I got no rival",
                "2:19:351": "Watch 'em run away",
                "2:21:221": "I got no, no, no",
                "2:22:770": "I got no, no, no rival",
                "2:24:149": "No rival",
                "2:29:116": "No rival",
                "2:33:194": "I got no, no, no",
                "2:34:695": "I got no, no, no rival",
                "2:41:239": "No rival",
                "2:59:204": "No rival",
            },
        }, {
            name: "do not resurrect - Necrotic Grip",
            src: "",
            sync: {
                "::": "Back off",
                "::": "I came to play",
                "::": "with my hacksaw",
                "::": "Bash in your brain",
                "::": "with my mask off",
                "::": "Yea try to pray",
                "::": "for the last time",
                "::": "Lame and you mad",
                "::": "but you hate",
                "::": "cuz your cash wrong",
                "::": "I don't want love",
                "::": "I want matte Glocks",
                "::": "I'll eat ya heart",
                "::": "like it's bath salts",
                "::": "I'll leave",
                "::": "his lung on the asphalt",
                "::": "I'll leave",
                "::": "your tongue in a glass jar",
                "::": "Murder with a black SCAR",
                "::": "He don't wanna dump",
                "::": "What the fuck",
                "::": "is it that hard?",
                "::": "He don't wanna buck",
                "::": "He respond with a sad bar",
                "::": "Nigga shoulda ducked",
                "::": "but he run like a track star",
                "::": "I came to play",
                "::": "with my hacksaw",
                "::": "I don't want pain",
                "::": "I want matte Glocks",
                "::": "I'll eat ya heart",
                "::": "like it's bath salts",
                "::": "I'll leave",
                "::": "his lung on the asphalt",
                "::": "Now I just be sippin'",
                "::": "sippin'",
                "::": "sippin' slow on the blood",
                "::": "I collect from you fuckers",
                "::": "And I could be vicious",
                "::": "witness never told of",
                "::": "the souls that",
                "::": "I left in my dungeon",
                "::": "Now cuz of my pigment",
                "::": "I been predisposed to unload",
                "::": "and attack in abundance",
                "::": "But that's just",
                "::": "the shit they said",
                "::": "I go and murder cuz simply",
                "::": "the fact that I love it",
                "::": "But it's back to the subject",
                "::": "Stacking bodies by the dozen",
                "::": "Whippin' Audis outta budget",
                "::": "Godly while I'm thumpin'",
                "::": "You would probly",
                "::": "caught a couple",
                "::": "Grippin' probly why",
                "::": "I'm fucked and",
                "::": "I don't plan on stoppin'",
                "::": "She do molly while we fuckin'",
                "::": "Creepin' I might grab a snub",
                "::": "I caught him out in public",
                "::": "Beam, he saw it",
                "::": "'fore it snuffed him",
                "::": "He was talking like he tough",
                "::": "and now he not so lucky",
                "::": "Back off",
                "::": "I came to play",
                "::": "with my hacksaw",
                "::": "Bash in your brain",
                "::": "with my mask off",
                "::": "Yea try to pray",
                "::": "for the last time",
                "::": "Lame and you mad",
                "::": "but you hate",
                "::": "cuz your cash wrong",
                "::": "I don't want love",
                "::": "I want matte Glocks",
                "::": "I'll eat ya heart",
                "::": "like it's bath salts",
                "::": "I'll leave",
                "::": "his lung on the asphalt",
                "::": "I'll leave",
                "::": "your tongue in a glass jar",
                "::": "Murder with a black SCAR",
                "::": "He don't wanna dump",
                "::": "What the fuck",
                "::": "is it that hard?",
                "::": "He don't wanna buck",
                "::": "He respond with a sad bar",
                "::": "Nigga shoulda ducked",
                "::": "but he run like a track star",
                "::": "I came to play",
                "::": "with my hacksaw",
                "::": "I don't want pain",
                "::": "I want matte Glocks",
                "::": "I'll eat ya heart",
                "::": "like it's bath salts",
                "::": "I'll leave",
                "::": "his lung on the asphalt",
                "::": "I came to play",
                "::": "with my hacksaw",
                "::": "I don't want pain",
                "::": "I want matte Glocks",
                "::": "I'll eat ya heart",
                "::": "like it's bath salts",
                "::": "I'll leave",
                "::": "his lung on the asphalt",
                "::": "I came to play",
                "::": "with my hacksaw",
                "::": "I don't want pain",
                "::": "I want matte Glocks",
                "::": "I'll eat ya heart",
                "::": "like it's bath salts",
                "::": "I'll leave",
                "::": "his lung on the asphalt",
            },
        }, {
            name: "Witchouse 40k - Black Rainbow",
            src: "",
            sync: {
                "::": "Terror when she told me",
                "::": "mmm",
                "::": "“This is what you wanted”",
                "::": "Somebody to hold me",
                "::": "mmm",
                "::": "It's all I ever wanted",
                "::": "Terror when she told me",
                "::": "mmm",
                "::": "“This is what you wanted”",
                "::": "Somebody to hold me",
                "::": "mmm",
                "::": "It's all I ever wanted",
                "::": "Mhmm",
                "::": "Mhmm",
                "::": "Mhmm",
                "::": "Mhmm",
                "::": "All I've got is time",
                "::": "No hands, no crown",
                "::": "Eternal the shine",
                "::": "When no one’s around",
                "::": "I’ve had no plans",
                "::": "on the lately",
                "::": "Paranoid they smile",
                "::": "when they hate me",
                "::": "Fuck a urinal",
                "::": "piss in the mainstream",
                "::": "What I gotta chop off",
                "::": "so you’ll place me",
                "::": "Choppin’ up snakey",
                "::": "Demons ovеrtake me",
                "::": "Nevеr had a good reason",
                "::": "to be hasty",
                "::": "‘Til the wheels",
                "::": "fell off of the daydream",
                "::": "Yeah we would just take it",
                "::": "when we lazy",
                "::": "Didn’t hesitate it’s wild",
                "::": "How we justify omega",
                "::": "When we get a taste of venom",
                "::": "Turn a quick fix",
                "::": "into big dilemma",
                "::": "I’m a dog",
                "::": "but I’m not sure",
                "::": "if I’ll go to heaven",
                "::": "Thought I knew better",
                "::": "Sneaking pills from her purse",
                "::": "Bitch move",
                "::": "I belong in a hearse",
                "::": "Addy got me feeling",
                "::": "like I’m fallin' in reverse",
                "::": "Patty told me hiding in",
                "::": "the shadows really",
                "::": "only gonna make it worse",
                "::": "You might also like",
                "::": "Walt Disney Wormdog",
                "::": "Grim Salvo",
                "::": "HEART OF DARKNESS",
                "::": "Grim Salvo",
                "::": "Feasting.On.The.Guts.Of.Angels",
                "::": "Grim Salvo",
                "::": "Terror when she told me",
                "::": "mmm",
                "::": "“This is what you wanted”",
                "::": "Somebody to hold me",
                "::": "mmm",
                "::": "It's all I ever wanted",
                "::": "Yeah, yeah, yeah, yeah",
                "::": "I just wanna",
                "::": "I just wanna",
                "::": "I just wanna—hold it",
                "::": "A future",
                "::": "that would’ve been golden",
                "::": "Rumors of realms",
                "::": "that don’t wither and fold in",
                "::": "All I smell is some",
                "::": "mold in the corners",
                "::": "What good are you for then?",
                "::": "Sweeter and more delectable",
                "::": "that torture",
                "::": "The more of those horrors",
                "::": "that tend to enfold them",
                "::": "Putrid the stench from",
                "::": "the stables",
                "::": "Forgotten rotted fable",
                "::": "scapegoats they holed in",
                "::": "I paid for your rage",
                "::": "a million days",
                "::": "Look at me now on my bullshit",
                "::": "Bitch I shit on this place",
                "::": "I was pulled in",
                "::": "Blood feathers break when",
                "::": "I shed",
                "::": "But not ever dead",
                "::": "Upgrading my cage",
                "::": "when I’m molting",
                "::": "Now that I’m free",
                "::": "what is even illegal?",
                "::": "Burn the whole church",
                "::": "'cause they’re perched",
                "::": "on the steeple",
                "::": "Go open the door",
                "::": "but you won’t see no people",
                "::": "Know some ring wraiths",
                "::": "that’ll feed on your face",
                "::": "if you don’t keep",
                "::": "your distance",
                "::": "We’re not going back",
                "::": "it’s a suicide mission",
                "::": "Lights in my head always",
                "::": "on every day is",
                "::": "like Christmas",
                "::": "Long as there’s one person",
                "::": "still out there listening",
                "::": "Then there’s",
                "::": "still a resistance",
                "::": "All our dead",
                "::": "dreams detonated",
                "::": "right at the core",
                "::": "of this mold pearl",
                "::": "We don’t need their assistance",
                "::": "Wait, hold it",
                "::": "Now I wield the dusty",
                "::": "bone blade of the Ogress",
                "::": "Sold us downriver",
                "::": "Sold us down the phlegethon",
                "::": "but we floated",
                "::": "Just wait…",
                "::": "'Cause a carpet of bones",
                "::": "'til there’s nothing left pulsing",
                "::": "Woefully",
                "::": "I cannot help",
                "::": "but to loathe this",
                "::": "I hope",
                "::": "that nobody knows this",
                "::": "I’ll be there to deliver",
                "::": "the finishing blow like a",
                "::": "slow kiss",
                "::": "What does he need?",
                "::": "Revenge",
                "::": "For what?",
                "::": "Being born",
                "::": "I’m gon' turn into a ghost",
                "::": "I don’t feel my body",
                "::": "They say I’m broken",
                "::": "shattered bones",
                "::": "I don’t feel nobody",
                "::": "I’m healing",
                "::": "scars up in the cold",
                "::": "leave me frozen now",
                "::": "I slowly walk a lonely road",
                "::": "I can’t save myself",
                "::": "Glock on me",
                "::": "I’m gon' walk out the coffin",
                "::": "I shot thirty",
                "::": "See me hop on the block",
                "::": "take a lot for me",
                "::": "I got bugs in my conscious",
                "::": "I rot…",
                "::": "Everyone plot on me",
                "::": "knock off his top",
                "::": "Fuck it",
                "::": "I've got slugs in my system",
                "::": "my shots loaded",
                "::": "Put the gun through",
                "::": "your vision and pop forty",
                "::": "Like a bully",
                "::": "I spin on your block",
                "::": "Spiderweb scope out the roof",
                "::": "'til they drop for me",
                "::": "I got all these demons",
                "::": "in my grave",
                "::": "that leave me vacant",
                "::": "Come and lay yo",
                "::": "body wit' me baby",
                "::": "won’t awaken",
                "::": "Talkin' wit' the devil",
                "::": "sold my soul",
                "::": "but I could take it",
                "::": "I had nothing left to heal",
                "::": "my heart",
                "::": "that's always breaking",
                "::": "I got all these demons",
                "::": "in my grave",
                "::": "that leave me vacant",
                "::": "Come and lay yo'",
                "::": "body wit' me baby",
                "::": "won’t awaken",
                "::": "Talkin' wit' the devil",
                "::": "sold my soul",
                "::": "but I could take it",
                "::": "I had nothing left to heal",
                "::": "my heart",
                "::": "that's always breaking",
                "::": "Terror when she told me",
                "::": "mmm",
                "::": "“This is what you wanted”",
                "::": "Somebody to hold me",
                "::": "mmm",
                "::": "It's all I ever wanted",
                "::": "Terror when she told me",
                "::": "mmm",
                "::": "“This is what you wanted”",
                "::": "Somebody to hold me",
                "::": "mmm",
                "::": "It's all I ever wanted",
                "::": "Yeah, yeah, yeah, yeah",
                "::": "I just wanna—hold it",
                "::": "A future",
                "::": "that would’ve been golden",
                "::": "Rumors of realms",
                "::": "that don’t wither and fold in",
                "::": "All I smell is some",
                "::": "mold in the corners",
                "::": "What good are you for then?",
                "::": "Sweeter and more delectable",
                "::": "that torture",
                "::": "The more of those horrors",
                "::": "that tend to enfold them",
                "::": "Putrid the stench from",
                "::": "the stables",
                "::": "Forgotten rotted fable",
                "::": "scapegoats they holed in",
                "::": "Etched like the",
                "::": "base of a grave",
                "::": "Covered in old magazine",
                "::": "and dead roses",
                "::": "Gotta put on a bold fac",
                "::": "for the lies and mistakes",
                "::": "All the pain happening",
                "::": "right underneath our noses",
                "::": "Woefully",
                "::": "I cannot help",
                "::": "but to loathe this",
                "::": "Woefully—Woefully—",
                "::": "I hope",
                "::": "that nobody knows this",
                "::": "A man like Ringo",
                "::": "has got agreat big hole",
                "::": "right through",
                "::": "the middle of him",
                "::": "He can never kill enough",
                "::": "or steal enough",
                "::": "or inflict enough",
                "::": "pain to ever fill it",
            },
        }, {
            name: "Grim Salvo - Feasting.On.The.Guts.Of.Angels",
            src: "https://cdn.discordapp.com/attachments/976188754417025144/1074693682336378890/Grim_Salvo_x_KAMAARA_-_Feasting.On.The.Guts.Of.Angels._OFFICIAL_AUDaddcommandmp3?ex=66bb68fc&is=66ba177c&hm=55c14fc592c489e7c6f6fcbc2c09e4057dd960ef44753c2163c16c6e8334d578&",
            sync: {
                "::": "You think that I won't",
                "::": "I'm sick of the front",
                "::": "I got no fuckin' patience",
                "::": "yeah yeah",
                "::": "She jump down my throat",
                "::": "Manage your expectations",
                "::": "yeah yeah",
                "::": "You're building a roof",
                "::": "When you got no foundation",
                "::": "yeah yeah",
                "::": "Signal the smoke",
                "::": "Spare me the altercation",
                "::": "yeah yeah",
                "::": "I'm sick of the front",
                "::": "I got no fucking patience",
                "::": "yeah yeah",
                "::": "She jump down my throat",
                "::": "Manage your expectations",
                "::": "yeah yeah",
                "::": "You're building a roof",
                "::": "When you got no foundation",
                "::": "yeah yeah",
                "::": "Signal the smoke",
                "::": "Spare me the altercation",
                "::": "yeah yeah",
                "::": "Been a minute since",
                "::": "I really took a minute",
                "::": "yeah yeah",
                "::": "Been fixated on",
                "::": "too many different women",
                "::": "yeah yeah",
                "::": "I've been spinnin'",
                "::": "avoidin' all of my feelings",
                "::": "yeah yeah",
                "::": "Spillin' my guts while",
                "::": "I'm starin' at the ceiling",
                "::": "yeah yeah",
                "::": "I've been here too many times",
                "::": "I'm slowly losing my mind",
                "::": "Bitch I'm broke",
                "::": "And I got holes in my clothes",
                "::": "But I am not impatient",
                "::": "yeah yeah",
                "::": "What the fuck do I want?",
                "::": "Think I got hesitations",
                "::": "yeah yeah",
                "::": "33 always gonna be spicy",
                "::": "Call it capsaicin",
                "::": "yeah yeah",
                "::": "Under the impression",
                "::": "that we're ever gonna stop",
                "::": "But you're fucking mistaken",
                "::": "yeah yeah",
                "::": "You a facade!",
                "::": "Bitch you so fraudulent",
                "::": "I can see it on your face",
                "::": "not so confident",
                "::": "Tried to manipulate",
                "::": "me and my brothers",
                "::": "Thinking I won't",
                "::": "but that bitch needs a buffer",
                "::": "Used to pawn licks",
                "::": "now I'm top of my game",
                "::": "Peeling the skin back",
                "::": "from under my face",
                "::": "Got a taste for it",
                "::": "now I just do it for thrills",
                "::": "Tried to bait me",
                "::": "put a shot in his gills",
                "::": "Not mad, I'm the gadfly",
                "::": "No cyanide 'cause the world just",
                "::": "gonna keep killing me still",
                "::": "Sleuthy like Socrates",
                "::": "No one's ever gonna",
                "::": "be able to say they bought me",
                "::": "Actin' like you not there",
                "::": "but I still care",
                "::": "Still stare with a blank face",
                "::": "Wonder what the fuck",
                "::": "is on the TV",
                "::": "with a Phoebe",
                "::": "Tell me take her someplace",
                "::": "'Cause she really wanna please me",
                "::": "Got them Blinders on like Peaky",
                "::": "I've been here too many times",
                "::": "I'm slowly losing my mind",
                "::": "See red in her eyes",
                "::": "All of these bitches evil",
                "::": "yeah yeah",
                "::": "You twisting your tongue",
                "::": "Twisting my mind, that's lethal",
                "::": "yeah yeah",
                "::": "Not part of the script",
                "::": "Taking you out the sequel",
                "::": "yeah yeah",
                "::": "Right before I leave",
                "::": "I'mma get revenge, Max Keeble",
                "::": "yeah yeah",
                "::": "I'mma save you the heartache",
                "::": "Think it's time",
                "::": "that we part ways",
                "::": "(yeah!)",
                "::": "Not here for the long wait",
                "::": "Think my time is a short stay",
                "::": "(what?)",
                "::": "You don't know the half of me",
                "::": "It's sad to see that everybody",
                "::": "Laughed at me like Sajudis, now",
                "::": "Bitches throw it back",
                "::": "for me so casually",
                "::": "Like 'deet da deet da",
                "::": "deet da deet da",
                "::": "deet da deet da deet'",
                "::": "Pour another cold one",
                "::": "swallow down a whole one",
                "::": "Checking my pulse;",
                "::": "am I dead? Can't tell",
                "::": "All that I know is",
                "::": "I'm leaving my soul",
                "::": "As you're in my ear screaming",
                "::": "'Burn in hell!'",
                "::": "Clip that! (What's up?)",
                "::": "'Cause one day, bitch",
                "::": "I'mma come back",
                "::": "Rub this shit in yo' face",
                "::": "eat your words that disgraced",
                "::": "No more MIAs, only KIAs",
                "::": "Where the dog tags?",
                "::": "You think that I won't",
                "::": "I'm sick of the front",
                "::": "I got no fuckin' patience",
                "::": "yeah yeah",
                "::": "She jump down my throat",
                "::": "Manage your expectations",
                "::": "yeah yeah",
                "::": "You're building a roof",
                "::": "When you-",
                "::": "When you got no foundation",
                "::": "yeah yeah",
                "::": "Signal the smoke",
                "::": "Spare me the altercation",
                "::": "yeah yeah",
                "::": "I'm sick of the front",
                "::": "I got no fuckin' patience",
                "::": "yeah yeah",
                "::": "She jump down my throat",
                "::": "Manage your expectations",
                "::": "yeah yeah",
                "::": "You're building a roof",
                "::": "When you got no foundation",
                "::": "yeah yeah",
                "::": "Signal the smoke",
                "::": "Spare me the altercation",
                "::": "yeah y—",
            },
        }, {
            name: "Initial D - Don't Stand so Close",
            src: "https://cdn.discordapp.com/attachments/976188754417025144/1074693171419820122/Initial_D_-_Dont_Stand_So_Close_AMV.mp3?ex=66bb6882&is=66ba1702&hm=9b14a80660267bf1d1756c35c3dbdd624d114472511003e5b6534422be0447f1&",
            sync: {
                "9:629": "We'll be together",
                "10:847": "'till the morning light",
                "12:877": "Don't stand so",
                "14:400": "Don't stand so",
                "15:928": "Don't stand so close to me",
                "30:895": "Baby you belong to me",
                "34:085": "Yes you do, yes you do",
                "35:377": "You're my affection",
                "37:118": "I can make a woman cry",
                "40:129": "Yes I do, yes I do",
                "41:668": "I will be good",
                "43:380": "You're like a cruel device",
                "45:041": "your blood is cold like ice",
                "46:605": "Posion for my veins",
                "48:205": "I'm breaking my chains",
                "49:710": "One look and you can kill",
                "51:228": "my pain now is your thrill",
                "52:817": "Your love is for me",
                "55:108": "I say, Try me",
                "56:567": "take a chance on emotions",
                "58:829": "For now and ever",
                "1:0:19": "close to your heart",
                "1:1:299": "I say, Try me",
                "1:2:725": "take a chance on my passion",
                "1:5:102": "We'll be together all the time",
                "1:7:383": "I say, Try me",
                "1:8:874": "take a chance on emotions",
                "1:11:142": "For now and ever into my heart",
                "1:13:279": "I say, Try me",
                "1:14:989": "take a chance on my passion",
                "1:17:349": "We'll be together",
                "1:18:429": "'till the morning light",
                "1:20:610": "Don't stand so",
                "1:22:210": "Don't stand so",
                "1:23:639": "Don't stand so close to me",
                "1:38:607": "Baby let me take control",
                "1:41:679": "Yes I do, yes I do",
                "1:43:254": "You are my target",
                "1:44:897": "No one ever made me cry",
                "1:47:969": "What you do, what you do",
                "1:49:406": "Baby's so bad",
                "1:51:134": "You're like a cruel device",
                "1:52:521": "your blood is cold like ice",
                "1:54:293": "Posion for my veins",
                "1:55:754": "I'm breaking my chains",
                "1:57:333": "One look and you can kill",
                "1:58:879": "my pain now is your thrill",
                "2:0:607": "Your love is for me",
                "2:2:690": "I say, Try me",
                "2:4:271": "take a chance on emotions",
                "2:6:599": "For now and ever",
                "2:7:824": "close to your heart",
                "2:8:715": "I say, Try me",
                "2:10:394": "take a chance on my passion",
                "2:12:733": "We'll be together all the time",
                "2:14:993": "I say, Try me",
                "2:16:298": "take a chance on emotions",
                "2:18:900": "For now and ever into my heart",
                "2:21:209": "I say, Try me",
                "2:22:652": "take a chance on my passion",
                "2:24:972": "We'll be together",
                "2:26:129": "'till the morning light",
                "2:28:216": "Don't stand so",
                "2:29:856": "Don't stand so",
                "2:31:296": "Don't stand so close to me",
                "2:58:89": "I say, Try me",
                "2:59:679": "take a chance on emotions",
                "3:1:937": "For now and ever",
                "3:3:47": "close to your heart",
                "3:4:231": "I say, Try me",
                "3:5:820": "take a chance on my passion",
                "3:8:140": "We'll be together all the time",
                "3:10:495": "I say, Try me",
                "3:11:883": "take a chance on emotions",
                "3:14:267": "For now and ever into my heart",
                "3:16:558": "I say, Try me",
                "3:18:67": "take a chance on my passion",
                "3:20:464": "We'll be together",
                "3:21:515": "'till the morning light",
                "3:23:694": "Don't stand so",
                "3:25:176": "Don't stand so",
                "3:26:768": "Don't stand so close to me",
                "3:41:739": "Try me",
                "3:42:830": "take a chance on emotions",
                "3:45:0": "For now and ever",
                "3:46:271": "close to your heart",
                "3:47:296": "I say, Try me",
                "3:48:816": "take a chance on my passion",
                "3:51:163": "We'll be together all the time",
                "3:53:505": "I say, Try me",
                "3:55:28": "take a chance on emotions",
                "3:57:379": "For now and ever into my heart",
                "3:59:667": "I say, Try me",
                "4:1:216": "take a chance on my passion",
                "4:3:507": "We'll be together",
                "4:4:755": "'till the morning light",
                "4:6:783": "Don't stand so",
                "4:8:292": "Don't stand so",
                "4:9:791": "Don't stand so close to me",
            },
        }, {
            name: "Initial D - The Top",
            src: "https://cdn.discordapp.com/attachments/976188754417025144/1074417409626226728/initial_D_MAD_The_Top_1.mp3?ex=66bbb930&is=66ba67b0&hm=707a90f2075c222c524b0ccff22366489a336ccf181bc2b853322db04763a7b9&",
            sync: {
                "39:401": "Final lap",
                "40:516": "I'm on top of the world",
                "41:618": "And I will never rest",
                "43:667": "for second again",
                "45:448": "One more time",
                "46:410": "I have beaten them out",
                "47:999": "The scent of gasoline",
                "49:831": "announces the end",
                "51:388": "They all said",
                "52:838": "I'd best give it up",
                "54:137": "What a fool",
                "55:40": "to believe their lies",
                "57:528": "Now they've fall",
                "58:976": "and I'm at the top",
                "1:0:116": "Are you ready now to die?",
                "1:3:151": "I came up from the bottom",
                "1:4:759": "and into the top",
                "1:6:170": "For the first time",
                "1:7:211": "I feel alive",
                "1:9:373": "I can fly like an eagle",
                "1:10:574": "strike like a hawk",
                "1:12:170": "Do you think",
                "1:12:997": "you can survive the top",
                "1:15:328": "the top",
                "1:27:347": "Final turn",
                "1:28:526": "and I'll settle the score",
                "1:30:177": "A rubber fire screams",
                "1:31:392": "into the night",
                "1:33:483": "Crash and burn is",
                "1:34:747": "what you're gonna do",
                "1:36:17": "I am a master",
                "1:37:77": "of the asphalt fight",
                "1:39:517": "They all said",
                "1:40:563": "I'd best give it up",
                "1:42:134": "What a fool",
                "1:42:846": "to believe their lies",
                "1:45:415": "Now they've fall",
                "1:46:775": "and I'm at the top",
                "1:48:175": "Are you ready now to die?",
                "1:51:55": "I came up from the bottom",
                "1:52:745": "and into the top",
                "1:54:225": "For the first time",
                "1:55:9": "I feel alive",
                "1:57:343": "I can fly like an eagle",
                "1:58:907": "strike like a hawk",
                "2:0:153": "Do you think",
                "2:0:794": "you can survive?",
                "2:3:120": "I came up from the bottom",
                "2:4:775": "and into the top",
                "2:6:92": "For the first time",
                "2:7:233": "I feel alive",
                "2:9:212": "I can fly like an eagle",
                "2:10:951": "strike like a hawk",
                "2:12:79": "Do you think",
                "2:12:904": "you can survive the top",
                "2:27:859": "What were you thinking",
                "2:28:721": "telling me to change my game?",
                "2:30:588": "This style wasn't",
                "2:31:247": "going anywhere",
                "2:32:216": "it was kaput!",
                "2:33:227": "You want to see what",
                "2:33:793": "I've done with this place",
                "2:35:39": "this whole thing?",
                "2:36:322": "You want to see that",
                "2:36:850": "I changed the game?",
                "2:37:471": "No, I AM the game!",
                "2:40:117": "Before I knew where",
                "2:40:698": "this was going",
                "2:41:320": "I would've listened to you",
                "2:42:392": "Right now",
                "2:42:992": "I distance myself from",
                "2:43:665": "what you have to say!",
                "2:44:894": "I made this",
                "2:45:650": "something way bigger",
                "2:46:403": "than you're ever gonna be",
                "2:47:926": "I made it this far",
                "2:49:494": "and I'm taking it to the top",
                "2:51:115": "I came up from the bottom",
                "2:52:854": "And into the top",
                "2:54:185": "For the first time",
                "2:55:106": "I feel alive!",
                "2:57:195": "I can fly like an eagle",
                "2:58:857": "And strike like a hawk",
                "3:0:30": "Do you think",
                "3:0:994": "you can survive...",
                "3:3:53": "I came up from the bottom",
                "3:4:751": "And into the top",
                "3:6:141": "For the first time",
                "3:7:211": "I feel alive!",
                "3:9:171": "I can fly like an eagle",
                "3:11:11": "And strike like a hawk",
                "3:12:91": "Do you think",
                "3:12:800": "you can survive... the top?",
                "3:51:44": "I came up from the bottom",
                "3:52:746": "And into the top",
                "3:54:26": "For the first time",
                "3:55:95": "I feel alive!",
                "3:57:135": "I can fly like an eagle",
                "3:58:615": "And strike like a hawk",
                "4:0:153": "Do you think",
                "4:0:776": "you can survive...",
                "4:3:102": "I came up from the bottom",
                "4:4:782": "And into the top",
                "4:6:32": "For the first time",
                "4:7:6": "I feel alive!",
                "4:9:57": "I can fly like an eagle",
                "4:10:876": "And strike like a hawk",
                "4:12:188": "Do you think",
                "4:12:852": "you can survive... the top?",
            },
        }, {
            name: "Initial D - Gas Gas Gas",
            src: "https://cdn.discordapp.com/attachments/976188754417025144/1074417409303269478/Manuel_-_Gas_Gas_Gas_1.mp3?ex=66bbb930&is=66ba67b0&hm=b8158574b71cbf58fd7682d65efa9a2cace9adb4769f3194e1c0cccb75a91585&",
            sync: {
                "16:852": "Ah",
                "20:9": "gas, gas, gas, gas",
                "23:124": "Ah",
                "28:271": "Do you like..",
                "29:853": "my car",
                "31:468": "m y c a r",
                "33:132": "m  y  c  a  r",
                "53:109": "Guess you're ready",
                "54:291": "'cause I'm waiting for you",
                "56:129": "It's gonna be so exciting",
                "59:290": "Got this feeling",
                "1:0:499": "really deep in my soul",
                "1:2:281": "Let's get out",
                "1:3:135": "I wanna go",
                "1:4:48": "come along",
                "1:4:855": "get it on",
                "1:5:993": "Gonna take my car",
                "1:7:562": "gonna sit in",
                "1:9:35": "Gonna drive along",
                "1:10:474": "'til I get you",
                "1:11:823": "'Cause I'm crazy",
                "1:12:562": "hot and ready",
                "1:13:541": "but you like it",
                "1:15:10": "I wanna race for you",
                "1:16:610": "(Shall I go now?)",
                "1:18:109": "Gas, gas, gas",
                "1:19:810": "I'm gonna step on the gas",
                "1:21:642": "Tonight, I'll fly",
                "1:22:962": "(and be your lover)",
                "1:24:370": "Yeah, yeah, yeah",
                "1:26:101": "I'll be so quick as a flash",
                "1:27:884": "And I'll be your hero",
                "1:30:651": "Gas, gas, gas",
                "1:32:379": "I'm gonna run as a flash",
                "1:34:59": "Tonight, I'll fight",
                "1:35:507": "(to be the winner)",
                "1:36:707": "Yeah, yeah, yeah",
                "1:38:547": "I'm gonna step on the gas",
                "1:40:286": "And you'll see the big show",
                "1:55:520": "Don't be lazy",
                "1:56:751": "'cause I'm burning for you",
                "1:58:340": "It's like a hot sensation",
                "2:1:733": "Got this power",
                "2:2:913": "that is taking me out",
                "2:4:681": "Yes, I've got a crush on you",
                "2:6:347": "ready, now",
                "2:7:174": "ready, go",
                "2:8:335": "Gonna take my car",
                "2:9:935": "gonna sit in",
                "2:11:481": "Gonna drive alone",
                "2:12:775": "'til I get you",
                "2:14:244": "'Cause I'm crazy",
                "2:14:975": "hot and ready",
                "2:15:999": "but you like it",
                "2:17:279": "I wanna race for you",
                "2:18:938": "(Shall I go now?)",
                "2:20:455": "Gas, gas, gas",
                "2:22:178": "I'm gonna step on the gas",
                "2:23:999": "Tonight, I'll fly",
                "2:25:311": "(and be your lover)",
                "2:26:738": "Yeah, yeah, yeah",
                "2:28:512": "I'll be so quick as a flash",
                "2:29:975": "And I'll be your hero",
                "2:32:978": "Gas, gas, gas",
                "2:34:668": "I'm gonna run as a flash",
                "2:36:447": "Tonight, I'll fight",
                "2:37:809": "(to be the winner)",
                "2:39:81": "Yeah, yeah, yeah",
                "2:40:931": "I'm gonna step on the gas",
                "2:42:463": "And you'll see the big show",
                "3:10:277": "Guess you're ready",
                "3:11:426": "'cause I'm waiting for you",
                "3:13:215": "It's gonna be so exciting",
                "3:16:471": "Got this feeling",
                "3:17:789": "really deep in my soul",
                "3:19:408": "Let's get out",
                "3:20:224": "I wanna go",
                "3:21:197": "come along",
                "3:22:34": "get it on",
                "3:23:234": "Gonna take my car",
                "3:25:986": "do you like",
                "3:27:605": "my car?",
                "3:29:5": "'Cause I'm crazy",
                "3:29:685": "hot and ready",
                "3:30:823": "but you like it",
                "3:32:133": "I wanna race for you",
                "3:33:653": "(Shall I go now?)",
                "3:36:813": "Gas, gas, gas",
                "3:38:514": "I'm gonna step on the gas",
                "3:40:185": "Tonight, I'll fly",
                "3:41:665": "(and be your lover)",
                "3:43:46": "Yeah, yeah, yeah",
                "3:44:756": "I'll be so quick as a flash",
                "3:46:354": "And I'll be your hero",
                "3:49:245": "Gas, gas, gas",
                "3:51:130": "I'm gonna run as a flash",
                "3:52:840": "Tonight, I'll fight",
                "3:54:90": "(to be the winner)",
                "3:55:448": "Yeah, yeah, yeah",
                "3:57:389": "I'm gonna step on the gas",
                "3:58:866": "And you'll see the big show",
                "4:1:797": "Gas, gas, gas",
                "4:4:805": "Yeah, yeah, yeah",
                "4:7:975": "Gas, gas, gas",
                "4:11:293": "And you'll see the big show",
                "4:28:89": "Ah"
            },
        }, {
            name: "Initial D - Running In The 90's",
            src: "https://cdn.discordapp.com/attachments/976188754417025144/1074691658643415050/Running_In_The_90s_2.mp3?ex=66bb671a&is=66ba159a&hm=dceecc6415d6ab87ca5dfa8cd40c53d396118b9e6e7066d62d2eb20836e168e4&",
            sync: {
                "37:412": "Modern talking",
                "38:991": "modern walking in the streets",
                "41:601": "New desire",
                "43:481": "Take me higher",
                "45:89": "lift me higher with your speed",
                "47:729": "I need fire",
                "49:220": "Get the satellite",
                "50:892": "if you want to see me",
                "52:225": "Talking on the net",
                "53:699": "I know the way you like it",
                "55:329": "Get your credit card",
                "56:862": "'cause I need no money",
                "58:339": "All I wanna get is you",
                "1:0:480": "baby",
                "1:1:344": "Running in the 90's",
                "1:3:976": "is a new way I like to be",
                "1:6:664": "I'm just running in the 90's",
                "1:10:141": "Come on baby, run to me",
                "1:12:800": "We are running in the 90's",
                "1:16:141": "it's a new way to set me free",
                "1:18:722": "I'm just running in the 90's",
                "1:22:242": "Yes, I wanna know",
                "1:23:850": "yes, I wanna see",
                "1:37:880": "Cyber talking",
                "1:39:613": "cybersex is on the line",
                "1:42:184": "New desire",
                "1:44:150": "Take me higher",
                "1:45:691": "boost me higher with your mind",
                "1:48:203": "Set me on fire",
                "1:49:645": "Get the satellite",
                "1:51:347": "if you want to see me",
                "1:52:769": "Talking on the net",
                "1:54:379": "I know the way you like it",
                "1:55:896": "Get your credit card",
                "1:57:307": "'cause I need no money",
                "1:58:617": "All I wanna get is you",
                "2:1:97": "baby",
                "2:1:814": "Running in the 90's",
                "2:4:582": "is a new way I like to be",
                "2:7:196": "I'm just running in the 90's",
                "2:10:595": "Come on baby, run to me",
                "2:13:233": "We are running in the 90's",
                "2:16:673": "it's a new way to set me free",
                "2:19:225": "I'm just running in the 90's",
                "2:22:868": "Yes, I wanna know",
                "2:24:325": "yes, I wanna see",
                "2:42:690": "New desire",
                "2:48:845": "I need fire",
                "3:2:496": "Running in the 90's",
                "3:5:165": "is a new way I like to be",
                "3:7:744": "I'm just running in the 90's",
                "3:11:424": "Come on, baby, run to me",
                "3:13:885": "We are running in the 90's",
                "3:17:333": "it's a new way to set me free",
                "3:19:971": "I'm just running in the 90's",
                "3:23:451": "Yes, I wanna know",
                "3:24:949": "yes, I wanna see",
                "3:45:179": "Take me higher",
                "3:46:699": "lift me higher with your speed",
                "3:49:356": "I need fire",
                "3:50:937": "Get the satellite",
                "3:53:983": "talking on the net",
                "3:56:922": "Get your credit card",
                "4:0:4": "all I wanna get",
                "4:2:899": "Running in the 90's",
                "4:8:968": "Running in the 90's",
                "4:15:200": "Running in the 90's",
                "4:21:190": "Running in the 90's",
            },
        }, {
            name: "Initial D - No One Sleep In Tokyo",
            src: "https://cdn.discordapp.com/attachments/1059159650026659842/1075151008910561330/Initial_D_-_No_One_Sleep_In_Tokyo.mp3?ex=66bbc167&is=66ba6fe7&hm=c9abd7160f50373066e4f2cfe2c5efbea402a206743a6811c2a83a0fdeae3137&",
            sync: {
                "666": "(4... 3... 2... 1...)",
                "19:197": "no one sleep in Tokyo",
                "22:301": "all right crossing the line",
                "25:392": "no one quit the radio",
                "28:432": "Tokyo is on fire",
                "43:821": "even if you say",
                "45:341": "'I have been the world wide'",
                "47:124": "I'll take you where",
                "48:190": "surely you have never been",
                "50:558": "all right in the fight",
                "52:47": "I'm OK... come on",
                "56:5": "come on",
                "59:374": "hey do you feel",
                "1:0:688": "the night is breathable",
                "1:2:760": "look at this town",
                "1:1:347": "which is unbelievable",
                "1:2:805": "no other places",
                "1:7:21": "like that in the world",
                "1:9:264": "worldddd",
                "1:10:144": "worlddddddddd (1, 2, 3, 4)",
                "1:11:825": "no one sleep in Tokyo",
                "1:14:843": "all right crossing the line",
                "1:18:137": "no one quit the radio",
                "1:21:203": "Tokyo is on fire",
                "1:24:393": "no one sleep in Tokyo",
                "1:27:302": "all right crossing the line",
                "1:30:403": "no one quit the radio",
                "1:33:473": "Tokyo is on fire",
                "1:48:894": "turning to the left",
                "1:50:364": "easy chicks and red lights",
                "1:52:367": "and to the right",
                "1:53:305": "crazy music everywhere",
                "1:55:705": "all right in the fight",
                "1:56:855": "I'm OK... come on",
                "2:0:924": "come on",
                "2:4:448": "hey do you feel",
                "2:5:832": "the night is breathable",
                "2:7:767": "look at this town",
                "2:8:514": "which is unbelievable",
                "2:10:885": "no other places",
                "2:11:984": "like that in the world",
                "2:14:333": "worldddd",
                "2:15:245": "worlddddddddd (1, 2, 3, 4)",
                "2:16:842": "no one sleep in Tokyo",
                "2:20:26": "all right crossing the line",
                "2:23:77": "no one quit the radio",
                "2:26:286": "Tokyo is on fire",
                "2:29:266": "no one sleep in Tokyo",
                "2:32:487": "all right crossing the line",
                "2:35:436": "no one quit the radio",
                "2:38:546": "Tokyo is on fire",
                "3:18:369": "(come on)",
                "3:32:566": "(1, 2, 3, 4)",
                "3:37:328": "all right crossing the line",
                "3:43:658": "Tokyo is on fire",
                "3:59:82": "hey do you feel",
                "4:0:318": "the night is breathable",
                "4:2:486": "look at this town",
                "4:3:515": "which is unbelievable",
                "4:5:525": "no other places",
                "4:6:600": "like that in the world",
                "4:8:992": "worldddd",
                "4:9:680": "worlddddddddd (1, 2, 3, 4)",
                "4:11:454": "no one sleep in Tokyo",
                "4:14:568": "all right crossing the line",
                "4:17:616": "no one quit the radio",
                "4:20:747": "Tokyo is on fire",
                "4:23:779": "no one sleep in Tokyo",
                "4:26:950": "all right crossing the line",
                "4:30:51": "no one quit the radio",
                "4:33:70": "Tokyo is on fire",
            },
        }, {
            name: "UNSECRET & Noeni - Fallout",
            src: "https://cdn.discordapp.com/attachments/1040928912118652928/1079764097169641552/Neoni_x_UNSECRET_-_Fallout_Official_Lyric_Video.mp3?ex=66bb662d&is=66ba14ad&hm=4bb95fbfe8495824cb9cb625821f024bbc15cf18422146055fc2b6094d74ab42&",
            sync: {
                "19:833": "Hush now, dry your eyes",
                "24:167": "Fate is upon us",
                "26:84": "The changing of times",
                "27:417": "Welcome blood red skies",
                "32:751": "Burn in wake of a",
                "35:1": "world left behind",
                "37:280": " DI YA, DA, DA",
                "39:238": "DA DA, DE DI YA",
                "40:613": "DA DA, DE DA",
                "45:988": "DI YA, DA, DA",
                "48:155": "DE, DI YA",
                "49:113": "DA DA",
                "50:125": "DE DI, YA",
                "51:257": "DA, DA, DE, DA",
                "53:632": "Can't escape the fallout",
                "58:48": "Feel the fire rain down",
                "1:2:382": "See the shadows",
                "1:3:531": "rising all around",
                "1:6:489": "Can't escape the FALLOUT,",
                "1:9:239": "fallout",
                "1:12:114": "Down to the ashes",
                "1:16:531": "Bones are left to dry",
                "1:20:781": "Waves of desolation",
                "1:25:031": "There's nowhere safe to hide",
                "1:29:971": "DI YA",
                "1:30:762": "DA DA DE",
                "1:31:972": "DI YA.",
                "1:32:346": "DA DA DE",
                "1:34:160": "DI YA",
                "1:35:35": "DA DA DE DA",
                "1:38:539": "DI YA",
                "1:39:372": "DA DA DE",
                "1:40:521": "DI YA",
                "1:41:729": "DA DA DE",
                "1:42:762": "DI YA",
                "1:43:878": "DA DA DE DA",
                "1:45:890": "Can't escape the fallout",
                "1:50:265": "Feel the fire rain down",
                "1:54:557": "See the shadows",
                "1:55:849": "rising all around",
                "1:58:897": "Can't escape the fallout,",
                "2:1:814": "FALLOUT!",
                "2:22:237": "DI YA",
                "2:23:153": "DA DA DE",
                "2:24:528": "DI YA.",
                "2:25:362": "DA DA DE",
                "2:26:305": "DI YA",
                "2:27:347": "DA DA DE DA",
                "2:30:730": "DI YA",
                "2:31:722": "DA DA DE",
                "2:33:49": "DI YA",
                "2:34:8": "DA DA DE",
                "2:35:133": "DI YA",
                "2:36:174": "DA DA DE DA",
                "2:46:921": "Can't escape the fallout!",
                "2:51:296": "Feel the fire rain down",
                "2:55:755": "See the shadows",
                "2:57:58": "rising all around",
                "3:0:183": "Can't escape the fallout",
                "3:2:433": "FALLOUT!",
                "3:4:642": "Can't escape the fallout,",
                "3:7:267": "FALLOUT!",
            },
        }, {
            name: "V O E - Giants",
            src: "https://cdn.discordapp.com/attachments/1065969963644506152/1079719316074790953/V_O_E_-_Giants_Extended_Mix_NCS_Release_1.mp3?ex=66bb3c79&is=66b9eaf9&hm=8b94db26d3c8fdc575e26f125e2a05c98468b1f325774acbf4f4e65b35f3bef9&",
            sync: {
                "10:639": "Oh, where am I going now",
                "12:163": "just falling over dreams",
                "16:299": "Now I'm just so far gone",
                "18:439": "this isn't what it seems",
                "21:785": "I'm taking this so d*mn long",
                "23:317": "it's fading from believe",
                "27:178": "I need to slow this down",
                "28:828": "it's burning from beneath",
                "32:909": "Come break this line",
                "36:175": "Before tomorrow dies,",
                "38:805": "Holding on for what",
                "40:547": "is worth my life",
                "44:175": "I know in time",
                "47:214": "I'll make it up the vine",
                "49:802": "Find my way to",
                "51:71": "giants in the sky",
                "53:974": "Tonight it comes to life.",
                "1:16:17": "Tonight it comes to life..",
                "1:38:829": "Oh, where am I going now",
                "1:40:450": "just falling over dreams",
                "1:44:520": "Now I'm just so far gone",
                "1:46:391": "this isn't what it seems",
                "1:49:974": "I'm taking this so d*mn long",
                "1:51:652": "it's fading from believe",
                "1:55:509": "I need to slow this down",
                "1:57:142": "it's burning from beneath",
                "2:1:269": "Come break this light",
                "2:4:52": "Before tomorrow dies,",
                "2:7:97": "Holding on for what",
                "2:8:785": "is worth my life",
                "2:12:322": "I know in time",
                "2:15:315": "I'll make it up the vine",
                "2:18:221": "Find my way to",
                "2:19:582": "giants in the sky",
                "2:21:175": "Tonight it comes to life.",
                "2:32:969": "Tonight it comes to life..",
                "2:56:461": "Come break this line",
                "2:59:450": "Before tomorrow dies,",
                "3:2:601": "Holding on for what",
                "3:3:853": "is worth my life",
                "3:7:617": "I know in time",
                "3:10:701": "I'll make it up the vine",
                "3:13:195": "Find my way to",
                "3:14:591": "giants in the sky",
                "3:17:446": "Tonight it comes to life.",
            },

        }, {
            name: "Neoni - Champion",
            src: "https://cdn.discordapp.com/attachments/1040928912118652928/1079696275303305256/Nightcore_-_CHAMPION_Lyrics.mp3?ex=66bbcfc3&is=66ba7e43&hm=c1e92abf3e8cdfa5de830fceb98d463c7d6202c0839f1813f463b6706ef3712f&",
            sync: {
                "14:689": "The battle's coming now...",
                "20:398": "The fury shakes the ground",
                "26:174": "I've come to take my crown",
                "31:525": "Im rising up",
                "32:155": "my heart is pounding",
                "34:382": "Ready or not the",
                "35:516": "clock is counting down",
                "37:322": "Whoa",
                "40:814": "This is my moment",
                "42:722": "Whoa",
                "46:581": "This is my moment..",
                "49:399": "This is my moment...",
                "52:074": "Whoa",
                "53:033": "I was born for greatness",
                "54:847": "Whoa",
                "55:709": "A legend in the making",
                "57:432": "Deep in my bones",
                "58:702": "Oh yeah I know",
                "1:0:743": "I am",
                "1:1:695": "I am the champion",
                "1:3:466": "Whoa",
                "1:4:597": "Come on try and take it",
                "1:6:366": "Whoa",
                "1:7:255": "It all comes down to this and",
                "1:8:781": "Deep in my bones",
                "1:10:414": "Oh yeah I know",
                "1:12:137": "I am",
                "1:13:180": "I am the champion",
                "1:17:852": "You know I'm out for blood",
                "1:23:339": "Im feeling dangerous",
                "1:29:235": "I just can't get enough",
                "1:34:722": "Im rising up",
                "1:35:555": "my heart is pounding",
                "1:37:353": "Ready or not the",
                "1:38:625": "clock is counting down",
                "1:43:976": "This is my moment..",
                "1:49:781": "This is my moment...",
                "1:52:684": "This is my moment yeah",
                "1:55:136": "Whoa",
                "1:56:117": "I was born for greatness",
                "1:58:079": "Whoa",
                "1:59:060": "A legend in the making",
                "2:0:557": "Deep in my bones",
                "2:1:963": "Oh yeah I know",
                "2:3:718": "I am",
                "2:4:931": "I am the champion",
                "2:6:609": "Whoa",
                "2:7:652": "Come on try to take it",
                "2:9:511": "Whoa",
                "2:10:645": "It all comes down to this and",
                "2:11:920": "Deep in my bones",
                "2:13:553": "Oh yeah I know",
                "2:15:231": "I am",
                "2:16:228": "I am the champion",
                "2:21:943": "I am the",
                "2:22:804": "I am the.",
                "2:26:627": "I am.",
                "2:27:897": "I am the champion",
                "2:29:756": "I know where I'm going",
                "2:32:840": "I have been chosen",
                "2:35:607": "I'll never be broken",
                "2:39:326": "I am the champion",
                "2:41:276": "A clashing of titans",
                "2:44:269": "A battle of giants",
                "2:46:555": "Take a moment of silence",
                "2:53:472": "I am the champion",
                "2:55:467": "Whoa",
                "2:56:510": "I was born for greatness",
                "2:58:279": "Whoa",
                "2:59:336": "A legend in the making",
                "3:0:878": "Deep in my bones",
                "3:2:238": "Oh yeah I know",
                "3:4:007": "I am",
                "3:5:186": "I am the champion",
                "3:6:955": "Whoa",
                "3:7:689": "Come on try to take it",
                "3:9:799": "Whoa",
                "3:10:797": "It all comes down to this and",
                "3:12:115": "Deep in my bones",
                "3:13:666": "Oh yeah I know",
                "3:15:515": "I am",
                "3:16:649": "I am the champion",
                "3:22:318": "I am the",
                "3:22:998": "I am the.",
                "3:27:033": "I am",
                "3:28:123": "I am the champion.",
            }
        }, {
            name: "JPB & Mendum - Losing Control",
            src: "https://cdn.discordapp.com/attachments/1040928912118652928/1080030493212409896/JPB__Mendum_-_Losing_Control_feat._Marvin_Divine_.mp3?ex=66bbb587&is=66ba6407&hm=f2426a253777b2ee493b882420260e8ad8be5e0010ef30ab3f1978e496663f1c&",
            sync: {
                "10:259": "(Losing control)",
                "12:346": "(I like losing control)",
                "15:384": "I like losing control",
                "18:220": "I get high when",
                "19:672": "I'm feeling my flow",
                "21:667": "My mind is focused",
                "22:665": "and I'm ready to go",
                "24:161": "Ready to go",
                "26:248": "Na na",
                "27:835": "I like losing control",
                "30:702": "I get high when Im feeling my",
                "32:788": "flow",
                "33:695": "My mind is focused and",
                "35:283": "I'm ready to go",
                "36:779": "Ready to go",
                "38:593": "Na na",
                "49:519": "I like losing control",
                "1:6:798": "Hahaha",
                "1:8:748": "Oh yeah",
                "1:12:58": "Are we talking",
                "1:13:65": "'bout losing control?",
                "1:15:287": "I'mma show you",
                "1:16:1": "how we lose control baby",
                "1:18:335": "haha",
                "1:19:877": "Watch this",
                "1:21:237": "Look, look",
                "1:22:779": "Marvin, marv (yeah)",
                "1:24:140": "Watch the way I start up(yeah)",
                "1:25:500": "I've been going hard,",
                "1:26:861": "I can go way harder (aha)",
                "1:28:493": "Every beat I'm on,",
                "1:29:854": "yeah you know that I spot her",
                "1:31:634": "and Im always looking gorgeous",
                "1:32:904": "Chillingwith somebody daughter",
                "1:34:673": "Yeah, she loves me (me)",
                "1:35:988": "Said she love the way my chain",
                "1:37:484": "Sit and cut the blade",
                "1:39:72": "And of course she says my name",
                "1:40:659": "If you want a way (aha)",
                "1:42:156": "To let you know we spent bloke",
                "1:43:652": "Always winning check the score",
                "1:45:466": "I'm only losing control, oh",
                "1:46:323": "I like losing control",
                "1:51:135": "I get high when",
                "1:52:360": "I'm feeling my flow",
                "1:54:264": "My mind is focused",
                "1:55:262": "and I'm ready to go",
                "1:57:212": "Ready to go",
                "1:59:208": "na na",
                "2:11:215": "I get high when",
                "2:12:712": "Im feeling my flow",
                "2:14:617": "Na, na",
                "2:15:650": "Losing control",
                "2:16:158": "Losing control",
                "2:17:1": "(Losing control)",
                "2:18:2": ".Losing control.",
                "2:19:3": "..Losing control..",
                "2:20:3": "...Losing control...",
                "2:21:3": "..Losing control..",
                "2:22:3": ".Losing control.",
                "2:23:3": "(Losing control)",
                "2:25:969": "!!!Losing control...",
                "2:26:500": "..Losing control..",
                "2:27:500": ".Losing control.",
                "2:28:500": "..Losing control..",
                "2:29:500": "...Losing control...",
                "2:30:500": "..Losing control..",
                "2:31:500": ".Losing control.",
                "2:32:500": "..Losing control..",
                "2:33:500": "...Losing control...",
                "2:34:9": "(Losing control)",
                "2:36:452": "Always winning check the score",
                "2:38:85": "I'm only losing control",
                "2:39:446": "I like losing control",
            },
        }, {
            name: "Freddie Dredd - Limbo",
            src: "https://cdn.discordapp.com/attachments/1027664063297224734/1080003023234928690/Freddie_Dredd_-_Limbo_Lyrics_1.mp3?ex=66bb9bf2&is=66ba4a72&hm=d08da99b41b88363bcf47e90caf4dd7a6ea0b0d90ac9587b3b0a88efeccfc106&",
            sync: {
                "13:750": "Walk around the world,",
                "15:42": "it feel like every",
                "16:3": "place the same",
                "17:1": "I look into your eyes and see",
                "18:861": "that you are in some pain",
                "20:28": "Freddie gonna help",
                "21:70": "the business",
                "22:1": "help a rope around your neck",
                "23:70": "Gonna help you make a choice",
                "24:945": "let it sit, don't let it rest",
                "26:320": "You a pest, what the f*ck",
                "27:778": "you left a mess",
                "28:945": "It's okay, I'll just say that",
                "30:695": "your body's gone today",
                "31:820": "You in Hell,",
                "32:736": "I don't think you failed,",
                "33:861": "you just made some bail",
                "35:111": "Come that day, it gets worse",
                "36:695": "and I hope you f*cking hurt",
                "38:70": "Now what's the word, captain?",
                "39:695": "I think I caught you lackin'",
                "41:486": "There are nine more layers",
                "43:140": "than this hell's packin'",
                "44:348": "No tippy tappin', bit*h",
                "46:431": "I come in rippy rappin'",
                "47:723": "I feel lucky I'm not you",
                "49:556": "At the top I do the do",
                "51:181": "Stuck in the fuc*in' darkness",
                "52:890": "and it's cold, at heart",
                "54:265": "Haven't felt sun in some days,",
                "55:598": "b*tch, where do I start?",
                "57:681": "Start from the top,",
                "58:890": "and the next stop the bottom",
                "1:0:931": "Rock bottom baby,",
                "1:2:265": "I swear I already got em'",
                "1:4:983": "Close your eyes",
                "1:5:774": "and think of something for me",
                "1:7:399": "Think of all the times that",
                "1:9:107": "you been feeling kinda lonely",
                "1:10:857": "What could you do with your",
                "1:12:268": "time instead?",
                "1:13:434": "What? You smoking weed,",
                "1:14:934": "you f*ck your b*tch and",
                "1:15:809": "go to bed",
                "1:16:934": "Notice all the colors that you",
                "1:18:559": "seeing in your head",
                "1:19:893": "Now strip away that s*it and",
                "1:21:393": "feel the darkness,",
                "1:22:309": "feel it spread",
                "1:23:434": "This is what is like to be",
                "1:24:601": "known as d*ad",
                "1:26:601": "Now open up your eyes,",
                "1:27:684": "you see the world it is red",
                "1:29:226": "Now what's the word, captain?",
                "1:30:893": "I think I caught you lackin",
                "1:32:601": "There are nine more layers",
                "1:34:309": "than this hell's packin'",
                "1:35:726": "No tippy tappin', b*tch",
                "1:37:330": "I come in rippy rappin'",
                "1:38:996": "I feel lucky I'm not you",
                "1:40:621": "At the top I do the do",
                "1:42:163": "Stuck in the fu*kin' darkness",
                "1:43:905": "and it's cold, at heart",
                "1:45:572": "Haven't felt sun in some days",
                "1:46:738": "b*tch, where do I start?",
                "1:48:863": "Start from the top,",
                "1:50:277": "Rock bottom baby,",
                "1:53:568": "I swear I already got em'",
                "1:55:27": "Now what's the word, captain?",
                "1:56:443": "I think I caught you lackin'",
                "1:58:193": "There are nine more layers",
                "2:0:235": "than this hell's packin'",
                "2:1:485": "No tippy tappin', b*tch",
                "2:2:985": "I come in rippy rappin'",
                "2:4:402": "I feel lucky I'm not you",
                "2:6:193": "At the top I do the do",
                "2:7:652": "Stuck in the f*ckin' darkness",
                "2:9:402": "and it's cold, at heart",
                "2:10:985": "Haven't felt sun in some days",
                "2:12:610": "b*tch, where do I start?",
                "2:14:568": "Start from the top,",
                "2:15:943": "and the next stop the bottom",
                "2:17:652": "Rock bottom baby,",
                "2:19:110": "I swear I already got em'",
            },
        }, {
            name: "Adrenaline - ACE",
            src: "https://cdn.discordapp.com/attachments/1030764523734441985/1081989273361842246/ADRENALINE_-_ACE.mp3?ex=66bb9589&is=66ba4409&hm=8b1ba8e84e44d8a0c2dabf12ed870cb4b94a2f22d884c2c1ebd2e2c8d9e8f956&",
            sync: {
                "1:0:816": "Body feels like lava flowin'",
                "1:3:428": "Hard adrenaline",
                "1:6:637": "Rushin' though the pain",
                "1:8:315": "and squeezing",
                "1:9:449": "Power's runnin' in my veins",
                "1:11:762": "Fight or flight",
                "1:13:258": "And my mind turns crazy",
                "1:15:753": "It's time to do or die",
                "1:18:746": "Fear thunders in my heart",
                "1:21:229": "and I, and I",
                "1:24:721": "Energy, a heart explosion",
                "1:27:896": "All I need, adrenaline",
                "1:30:753": "Never stop to is in my mind",
                "1:33:565": "Fire away, adrenaline",
                "1:36:785": "Rollercoaster of emotion",
                "1:39:869": "I just need adrenaline",
                "1:42:635": "Setting all the worlds afire",
                "1:45:583": "Energy, adrenaline",
                "2:1:33": "It's no game, we're messin'",
                "2:2:847": "'round with",
                "2:3:981": "Hard adrenaline",
                "2:7:246": "Waste a wave of hungryfeelings",
                "2:10:285": "Just bring out the best in me",
                "2:12:643": "Fight or flight",
                "2:14:185": "And my mind turns crazy",
                "2:16:453": "It's time to do or die",
                "2:19:128": "Fear thunders in my heart",
                "2:21:940": "and I, and I",
                "2:25:468": "Energy, a heart explosion",
                "2:28:371": "All I need, adrenaline",
                "2:31:545": "Never stop to is in my mind",
                "2:34:584": "Fire away, adrenaline",
                "2:37:441": "Rollercoaster of emotion",
                "2:40:752": "I just need adrenaline",
                "2:43:563": "Setting all the worlds afire",
                "2:46:693": "Energy, adrenaline",
                "3:40:48": "Energy, a heart explosion",
                "3:42:995": "All I need, adrenaline",
                "3:45:995": "Never stop to is in my mind",
                "3:48:995": "Fire away, adrenaline",
                "3:53:653": "Rollercoaster of emotion",
                "3:56:374": "I just need adrenaline",
                "3:59:549": "Setting all the worlds afire",
                "4:2:542": "Energy, adrenaline",
                "4:18:160": "A D R E N A L I N E",
            }
        }];
        //Thanks To BySylex For Making Song Chats
        var converToJSDelay = (time) => {
            let newTime = time.split(":").reverse();
            time = 0;
            let convert = [6e4 * 60, 6e4, 1000, 1].reverse();
            newTime.forEach((b, c) => {
                time += b * convert[c];
            });
            return time;
        };
        songs.forEach(e => {
            let oldDatas = e.sync;
            e.sync = {};
            for (let time in oldDatas) {
                e.sync[converToJSDelay(time)] = oldDatas[time];
            }
        });
        /*   for(let i of songs){
           let option = document.createElement("option");
           option.text = i.name;
           option.value = i.name;
           document.getElementById("songs").add(option);
       }*/
        function findP(e) {
            for (var t = 0; t < players.length; ++t)
                if (players[t].sid == e)
                    return players[t];
            return null
        }

        function bn(e) {
            for (var t = 0; t < X.length; ++t)
                if (X[t].sid == e)
                    return X[t];
            return null
        }

        function xn(e) {
            for (var t = 0; t < W.length; ++t)
                if (W[t].sid == e)
                    return W[t];
            return null
        }

        function Sn(e) {
            for (var t = 0; t < N.length; ++t)
                if (N[t].sid == e)
                    return N[t];
            return null
        }
        var In = -1;

        function Tn() {
            var e = Date.now() - In;
            window.pingTime = e,
                Ie.innerText = "Ping: " + e + " ms"
        }

        function Mn() {
            In = Date.now(),
                s.send("pp")
        }

        function Cn(e) {
            if (!(e < 0)) {
                var t = Math.floor(e / 60),
                    i = e % 60;
                i = ("0" + i).slice(-2),
                    Te.innerText = "Server restarting in " + t + ":" + i,
                    Te.hidden = !1
            }
        }

        function Pn(e) {
            window.open(e, "_blank")
        }
        function findItemHealth (_) {
            let objs = [{name:"apple",desc:"restores 20 health when consumed",req:["food",10],consume:function(e){return e.changeHealth(20,e)},scale:22,holdOffset:15},{age:3,name:"cookie",desc:"restores 40 health when consumed",req:["food",15],consume:function(e){return e.changeHealth(40,e)},scale:27,holdOffset:15},{age:7,name:"cheese",desc:"restores 30 health and another 50 over 5 seconds",req:["food",25],consume:function(e){return!!(e.changeHealth(30,e)||e.health<100)&&(e.dmgOverTime.dmg=-10,e.dmgOverTime.doer=e,e.dmgOverTime.time=5,!0)},scale:27,holdOffset:15},{name:"wood wall",desc:"provides protection for your village",req:["wood",10],projDmg:!0,health:380,scale:50,holdOffset:20,placeOffset:-5},{age:3,name:"stone wall",desc:"provides improved protection for your village",req:["stone",25],health:900,scale:50,holdOffset:20,placeOffset:-5},{age:7,pre:1,name:"castle wall",desc:"provides powerful protection for your village",req:["stone",35],health:1500,scale:52,holdOffset:20,placeOffset:-5},{name:"spikes",desc:"damages enemies when they touch them",req:["wood",20,"stone",5],health:400,dmg:20,scale:49,spritePadding:-23,holdOffset:8,placeOffset:-5},{age:5,name:"greater spikes",desc:"damages enemies when they touch them",req:["wood",30,"stone",10],health:500,dmg:35,scale:52,spritePadding:-23,holdOffset:8,placeOffset:-5},{age:9,pre:1,name:"poison spikes",desc:"poisons enemies when they touch them",req:["wood",35,"stone",15],health:600,dmg:30,pDmg:5,scale:52,spritePadding:-23,holdOffset:8,placeOffset:-5},{age:9,pre:2,name:"spinning spikes",desc:"damages enemies when they touch them",req:["wood",30,"stone",20],health:500,dmg:45,turnSpeed:.003,scale:52,spritePadding:-23,holdOffset:8,placeOffset:-5},{name:"windmill",desc:"generates gold over time",req:["wood",50,"stone",10],health:400,pps:1,turnSpeed:.0016,spritePadding:25,iconLineMult:12,scale:45,holdOffset:20,placeOffset:5},{age:5,pre:1,name:"faster windmill",desc:"generates more gold over time",req:["wood",60,"stone",20],health:500,pps:1.5,turnSpeed:.0025,spritePadding:25,iconLineMult:12,scale:47,holdOffset:20,placeOffset:5},{age:8,pre:1,name:"power mill",desc:"generates more gold over time",req:["wood",100,"stone",50],health:800,pps:2,turnSpeed:.005,spritePadding:25,iconLineMult:12,scale:47,holdOffset:20,placeOffset:5},{age:5,type:2,name:"mine",desc:"allows you to mine stone",req:["wood",20,"stone",100],iconLineMult:12,scale:65,holdOffset:20,placeOffset:0},{age:5,type:0,name:"sapling",desc:"allows you to farm wood",req:["wood",150],iconLineMult:12,colDiv:.5,scale:110,holdOffset:50,placeOffset:-15},{age:4,name:"pit trap",desc:"pit that traps enemies if they walk over it",req:["wood",30,"stone",30],trap:!0,ignoreCollision:!0,hideFromEnemy:!0,health:500,colDiv:.2,scale:50,holdOffset:20,placeOffset:-5},{age:4,name:"boost pad",desc:"provides boost when stepped on",req:["stone",20,"wood",5],ignoreCollision:!0,boostSpeed:1.5,health:150,colDiv:.7,scale:45,holdOffset:20,placeOffset:-5},{age:7,doUpdate:!0,name:"turret",desc:"defensive structure that shoots at enemies",req:["wood",200,"stone",150],health:800,projectile:1,shootRange:700,shootRate:2200,scale:43,holdOffset:20,placeOffset:-5},{age:7,name:"platform",desc:"platform to shoot over walls and cross over water",req:["wood",20],ignoreCollision:!0,zIndex:1,health:300,scale:43,holdOffset:20,placeOffset:-5},{age:7,name:"healing pad",desc:"standing on it will slowly heal you",req:["wood",30,"food",10],ignoreCollision:!0,healCol:15,health:400,colDiv:.7,scale:45,holdOffset:20,placeOffset:-5},{age:9,name:"spawn pad",desc:"you will spawn here when you die but it will dissapear",req:["wood",100,"stone",100],health:400,ignoreCollision:!0,spawnPoint:!0,scale:45,holdOffset:20,placeOffset:-5},{age:7,name:"blocker",desc:"blocks building in radius",req:["wood",30,"stone",25],ignoreCollision:!0,blocker:300,health:400,colDiv:.7,scale:45,holdOffset:20,placeOffset:-5},{age:7,name:"teleporter",desc:"teleports you to a random point on the map",req:["wood",60,"stone",60],ignoreCollision:!0,teleport:!0,health:200,colDiv:.7,scale:45,holdOffset:20,placeOffset:-5}]
            let item = objs.find(e => e.name == _.name);
            return item || null;
        }
        function easeUp(currentValue, targetValue, easeAmount) {
            return Math.max(currentValue, currentValue + (targetValue - currentValue) * easeAmount);
        }
        function easeDown(currentValue, targetValue, easeAmount) {
            return Math.min(currentValue, currentValue - (currentValue - targetValue) * easeAmount);
        }
        let relMin = 55;
        let relMax = 385;
        function getBarColor(float, isPri, isT) {
            if(isPri) {
                return float <= 0.3703703703703704 ? '#8ecc51' : float <= 0.7407407407407408 ? `hsl(${relMin}, 50%, 60%)` : '#f9f64f';
            } else {
                let max = 1-float;
                if(isT){
                    let hsl = `hsl(${Math.round(relMax + max*(relMin-relMax))%360}, 50%, 60%)`;
                    return float == 1 ? '#f9f64f' : hsl;
                } else {
                    if(U.weapons[1] != 10){
                        let hsl = `hsl(${Math.round(relMax + max*(relMin-relMax))%360}, 50%, 60%)`;
                        return float == 1 ? '#f9f64f' : hsl;
                    } else if(U.weapons[1] == 10){

                        let hsl = `hsl(${Math.round(relMax + max*(relMin-relMax))%360}, 50%, 60%)`;
                        return float <= 0.3703703703703704 ? '#73bfa2' : float <= 0.7407407407407408 ? `#8ecc51` : '#f9f64f';
                    }
                }
            }
        }
        function changeColor(variable, startHex, endHex) {
            // Calculate the progress based on the variable value
            const progress = variable.value / variable.maxValue;

            // Convert the hex colors to RGB
            const start = hexToRGB(startHex);
            const end = hexToRGB(endHex);

            // Calculate the current color based on the progress
            const red = Math.floor(start.r + (end.r - start.r) * progress);
            const green = Math.floor(start.g + (end.g - start.g) * progress);
            const blue = Math.floor(start.b + (end.b - start.b) * progress);

            // Return the color as a CSS string
            return `rgb(${red}, ${green}, ${blue})`;
        }

        function hexToRGB(hex) {
            return {
                r: parseInt(hex.slice(1, 3), 16),
                g: parseInt(hex.slice(3, 5), 16),
                b: parseInt(hex.slice(5, 7), 16)
            };
        }
        const nightTarget = [24, 47, 82, .3];
        let nightMode = 1;
        let Nights = 0;
        function doCanvasFade(){
            Nights += ((nite ? nightMode = 1 : nightMode = 0) - Nights) / 160;
            const eb = ve.getTransform();
            ve.save();
            ve.globalAlpha = 1;
            ve.setTransform(1, 0, 0, 1, 0, 0);
            ve.fillStyle = `rgba(${[24, 0, 82, .26].map(e => e * Nights).join(", ")})`;
            ve.fillRect(0, 0, we.width, we.height);
            ve.setTransform(eb);
            ve.restore()
        }
        window.requestAnimFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(e) {
            window.setTimeout(e, 1e3 / 60)
        };
        let rotationAngle = 0;

        function updateAngle() {
            rotationAngle += Math.PI / 12;
        }

        setInterval(updateAngle, 100);
        (function() {
            var e = r.mapScale / 2;
            tt.add(0, e, e + 200, 0, r.treeScales[3], 0),
                tt.add(1, e, e - 480, 0, r.treeScales[3], 0),
                tt.add(2, e + 300, e + 450, 0, r.treeScales[3], 0),
                tt.add(3, e - 950, e - 130, 0, r.treeScales[2], 0),
                tt.add(4, e - 750, e - 400, 0, r.treeScales[3], 0),
                tt.add(5, e - 700, e + 400, 0, r.treeScales[2], 0),
                tt.add(6, e + 800, e - 200, 0, r.treeScales[3], 0),
                tt.add(7, e - 260, e + 340, 0, r.bushScales[3], 1),
                tt.add(8, e + 760, e + 310, 0, r.bushScales[3], 1),
                tt.add(9, e - 800, e + 100, 0, r.bushScales[3], 1),
                tt.add(10, e - 800, e + 300, 0, l.list[4].scale, l.list[4].id, l.list[10]),
                tt.add(11, e + 650, e - 390, 0, l.list[4].scale, l.list[4].id, l.list[10]),
                tt.add(12, e - 400, e - 450, 0, r.rockScales[2], 2)
        }());
        (function e() {//updategame
            O = Date.now(),
                E = O - q,
                q = O,
                function() {
                ticked += E;
                let camPlayer = camFollow.toggle ? findP(camFollow.target) || A : A;
                if (xi < 120 && (xi += .1 * E,
                                 Ne.style.fontSize = Math.min(Math.round(xi), 120) + "px"),
                    camPlayer) {
                    var e = o.getDistance(R, L, camPlayer.x, camPlayer.y),
                        t = o.getDirection(camPlayer.x, camPlayer.y, R, L),
                        i = Math.min(.01 * e * E, e);
                    e > .05 ? (R += i * Math.cos(t),
                               L += i * Math.sin(t)) : (R = camPlayer.x,
                                                        L = camPlayer.y)
                } else {
                    R = r.mapScale / 2;
                    L = r.mapScale / 2;
                }
                for (var n = O - 1e3 / r.serverUpdateRate, a = 0; a < X.length + W.length; ++a)
                    if ((U = X[a] || W[a - X.length]) && U.visible)
                        if (U.forcePos)
                            U.x = U.x2,
                                U.y = U.y2,
                                U.dir = U.d2;
                        else {
                            var c = U.t2 - U.t1,
                                q = (n - U.t1) / c;
                            U.dt += E;
                            var h = Math.min(1.7, U.dt / 170),
                                u = U.x2 - U.x1;
                            U.x = U.x1 + u * h,
                                u = U.y2 - U.y1,
                                U.y = U.y1 + u * h,
                                U.dir = Math.lerpAngle(U.d2, U.d1, Math.min(1.2, q))
                        }
                var d = R - ae / 2,
                    f = L - re / 2;
                r.snowBiomeTop - f <= 0 && r.mapScale - r.snowBiomeTop - f >= re ? (ve.fillStyle = "#b6db66",
                                                                                    ve.fillRect(0, 0, ae, re)) : r.mapScale - r.snowBiomeTop - f <= 0 ? (ve.fillStyle = "#dbc666",
                        ve.fillRect(0, 0, ae, re)) : r.snowBiomeTop - f >= re ? (ve.fillStyle = "#fff",
                                                                                 ve.fillRect(0, 0, ae, re)) : r.snowBiomeTop - f >= 0 ? (ve.fillStyle = "#fff",
                                                                                                                                         ve.fillRect(0, 0, ae, r.snowBiomeTop - f),
                                                                                                                                         ve.fillStyle = "#b6db66",
                                                                                                                                         ve.fillRect(0, r.snowBiomeTop - f, ae, re - (r.snowBiomeTop - f))) : (ve.fillStyle = "#b6db66",
                        ve.fillRect(0, 0, ae, r.mapScale - r.snowBiomeTop - f),
                        ve.fillStyle = "#dbc666",
                        ve.fillRect(0, r.mapScale - r.snowBiomeTop - f, ae, re - (r.mapScale - r.snowBiomeTop - f)));
                wi || ((Z += ee * r.waveSpeed * E) >= r.waveMax ? (Z = r.waveMax, ee = -1) : Z <= 1 && (Z = ee = 1),
                       ve.globalAlpha = 1,
                       ve.fillStyle = "#dbc666",
                       zi(d, f, ve, r.riverPadding),
                       ve.fillStyle = "#91b2db",
                       zi(d, f, ve, 250 * (Z - 1)));
                ve.lineWidth = 4;
                ve.strokeStyle = "#000";
                ve.globalAlpha = .025;
                ve.beginPath();
                for (var p = -R; p < ae; p += re / 18)
                    p > 0 && (ve.moveTo(p, 0),
                              ve.lineTo(p, re));
                for (var g = -L; g < re; g += re / 18)
                    p > 0 && (ve.moveTo(0, g),
                              ve.lineTo(ae, g));
                for (ve.stroke(),
                     ve.globalAlpha = 1,
                     ve.strokeStyle = it,
                     _i(-1, d, f),
                     ve.globalAlpha = 1,
                     ve.lineWidth = 5.5,
                     Ui(0, d, f),
                     Hi(d, f, 0),
                     ve.globalAlpha = 1,
                     a = 0; a < W.length; ++a)
                    (U = W[a]).active && U.visible && (U.animate(E),
                                                       ve.save(),
                                                       ve.translate(U.x - d, U.y - f),
                                                       ve.rotate(U.dir + U.dirPlus - Math.PI / 2),
                                                       fn(U, ve),
                                                       ve.restore());
                _i(0, d, f);
                Ui(1, d, f);
                _i(1, d, f);
                Hi(d, f, 1);
                _i(2, d, f);
                _i(3, d, f);
                doCanvasFade()
                for(let i = 0; i<N.length;i++){
                    let _ = N[i];
                    const width = r.healthBarWidth / 2 - r.healthBarPad / 2;
                    const itemHealth = findItemHealth({name: _.name});
                    if (itemHealth !== null && _.active && _.health < itemHealth.health && cdf(A, _) < 400) {
                        const color = A && _.owner && _.owner.sid == A.sid
                        ? changeColor({value:_.health, maxValue: itemHealth.health}, "#0b7572", "#9bccca")
                        : _.owner && A && A.team &&  It.includes(_.owner.sid)
                        ? changeColor({value:_.health, maxValue: itemHealth.health}, "#0b7572", "#9bccca")
                        : changeColor({value:_.health, maxValue: itemHealth.health}, "#e6c1c1", "#ad2d2d");
                        ve.save();
                        ve.globalAlpha = 0.7;
                        ve.fillStyle = "#28292b";
                        ve.roundRect(_.x - d - width - r.healthBarPad,
                                     _.y - f-8,
                                     2 * width + 2 * r.healthBarPad,
                                     17,
                                     8);
                        ve.fill();
                        ve.fillStyle = color;
                        ve.roundRect(_.x - d - width,
                                     _.y - f + r.healthBarPad-8,
                                     2 * width * (_.health / itemHealth.health),
                                     17 - 2 * r.healthBarPad,
                                     7);
                        ve.fill();
                        ve.restore();
                    }
                }
                ve.fillStyle = "#000";
                ve.globalAlpha = .09;
                d <= 0 && ve.fillRect(0, 0, -d, re);
                if (r.mapScale - d <= ae) {
                    var y = Math.max(0, -f);
                    ve.fillRect(r.mapScale - d, y, ae - (r.mapScale - d), re - y)
                }
                f <= 0 && ve.fillRect(-d, 0, ae + d, -f);
                if (r.mapScale - f <= re) {
                    let k = Math.max(0, -d),
                        w = 0;
                    r.mapScale - d <= ae && (w = ae - (r.mapScale - d)),
                        ve.fillRect(k, r.mapScale - f, ae - k - w, re - (r.mapScale - f))
                }
                ve.globalAlpha = 1;
                ve.fillStyle = "rgba(0, 0, 70, 0.35)";
                ve.fillRect(0, 0, ae, re);
                if(player){
                    ve.save();
                    ve.globalAlpha = 0.6;
                    ve.translate(-d, -f);
                    Pathfinder.drawPath(ve, "rgba(255,255,255,0.5)", player, "rgba(255,255,255,0.5)");
                    //Tach.drawWaypoints(mainContext, player.skinRot);
                    ve.restore();
                }
                ve.strokeStyle = nt;
                for (let a = 0; a < X.length + W.length; ++a)
                    if ((U = X[a] || W[a - X.length]).visible) {
                        let k;
                        var v = (U.team ? `[${U.team}] ` : "") + (U.name || "");
                        if ("" != v) {
                            ve.save();
                            ve.font = (U.nameScale || 30) + "px Hammersmith One";
                            ve.fillStyle = "#fff";
                            ve.textBaseline = "middle";
                            ve.textAlign = "center";
                            ve.lineWidth = U.nameScale ? 11 : 8;
                            ve.lineJoin = "round";
                            ve.globalAlpha = cdf(U, A) < 400? 1: 1-((cdf(U, A)-400)/900);
                            ve.strokeText(v, U.x - d, U.y - f - U.scale - r.nameY);
                            ve.fillText(v, U.x - d, U.y - f - U.scale - r.nameY);
                            if (U.isLeader && Ci.crown.isLoaded) {
                                var b = r.crownIconScale;
                                k = U.x - d - b / 2 - ve.measureText(v).width / 2 - r.crownPad,
                                    ve.drawImage(Ci.crown, k, U.y - f - U.scale - r.nameY - b / 2 - 5, b, b)
                            }
                            1 == U.iconIndex && Ci.skull.isLoaded && (b = r.crownIconScale,
                                                                      k = U.x - d - b / 2 + ve.measureText(v).width / 2 + r.crownPad,
                                                                      ve.drawImage(Ci.skull, k, U.y - f - U.scale - r.nameY - b / 2 - 5, b, b))
                            ve.restore();
                        }
                        let shameImage = new Image();
                        shameImage.src = "https://cdn.discordapp.com/attachments/945393597820305458/977291606082334731/L_1nzer4694.png?ex=66bbb3bc&is=66ba623c&hm=044d0cf2308bf186366d4abf408eeedf16cc09aa04f59fe8217eb22d2a194525&";
                        shameImage.isLoaded = false;
                        shameImage.onload = function() {
                            shameImage.isLoaded = true;
                        }
                        if(U.isPlayer && !vism.toggle){
                            let targetReloads = {
                                primary: (U.weapons[0] == undefined ? 1 : ((items.weapons[U.weapons[0]].speed - U.reloads[U.weapons[0]]) / items.weapons[U.weapons[0]].speed)),
                                secondary: (U.weapons[1] == undefined ? 1 : ((items.weapons[U.weapons[1]].speed - U.reloads[U.weapons[1]]) / items.weapons[U.weapons[1]].speed)),
                            };
                            if (!U.currentReloads) {
                                U.currentReloads = { // Initialize currentReloads if not already set
                                    primary: targetReloads.primary,
                                    secondary: targetReloads.secondary,
                                };
                            }
                            const lerpFactor = 0.5;
                            U.currentReloads.primary = (1 - lerpFactor) * U.currentReloads.primary + lerpFactor * targetReloads.primary;
                            U.currentReloads.secondary = (1 - lerpFactor) * U.currentReloads.secondary + lerpFactor * targetReloads.secondary;
                            U.currentReloads.turret = (1 - lerpFactor) * U.currentReloads.turret + lerpFactor * targetReloads.turret;
                            //roundRect(x, y, width, height, radii)
                            let p1 = U.x - d - U.scale * 2;
                            let p2 = U.x - d - U.scale * 2 + r.healthBarPad;
                            let s1 = U.x - d - U.scale * 2 - 17 - 2;
                            let s2 = U.x - d - U.scale * 2 + r.healthBarPad - 17 - 2;
                            if(U.weapons[1] !== void 0 && U.reloads[U.weapons[1]]){
                                let index = U.currentReloads.secondary;
                                k = U.y - f - U.scale + r.nameY - 17 + r.healthBarPad - 8;
                                ve.fillStyle = nt;
                                ve.roundRect(p1,k,17,r.healthBarWidth + 2 * r.healthBarPad,5);
                                ve.fill();
                                k = U.y - f - U.scale + r.nameY + r.healthBarPad - 17 + r.healthBarPad - 8;
                                ve.fillStyle = getBarColor(U.reloads[U.weapons[1]], 0, 1);
                                ve.roundRect(p2,k,17 - 2*r.healthBarPad,((r.healthBarWidth + 2 * r.healthBarPad) - (r.healthBarWidth + 2 * r.healthBarPad) * index) - 2 * r.healthBarPad,5);
                                ve.fill()
                            }
                            if(U.weapons[0] !== void 0 && U.reloads[U.weapons[0]]){
                                let index = U.currentReloads.primary;
                                k = U.y - f - U.scale + r.nameY - 17 + r.healthBarPad - 8;
                                ve.fillStyle = nt;
                                ve.roundRect(!U.reloads[U.weapons[1]]?p1:s1,k,17,r.healthBarWidth + 2 * r.healthBarPad,5);
                                ve.fill();
                                k = U.y - f - U.scale + r.nameY + r.healthBarPad - 17 + r.healthBarPad - 8;
                                ve.fillStyle = changeColor({value:U.reloads[U.weapons[0]], maxValue: l.weapons[U.weapons[0]].speed}, "#3f6cb0", "#adbfd9");
                                ve.roundRect(!U.reloads[U.weapons[1]]?p2:s2,k,17 - 2*r.healthBarPad,((r.healthBarWidth + 2 * r.healthBarPad) - (r.healthBarWidth + 2 * r.healthBarPad) * index) - 2 * r.healthBarPad,5);
                                ve.fill()
                            }
                            let googoogaagaa = (r.healthBarWidth * (U.clownTimer / 30))
                            let gaagaagoogoo = (r.healthBarWidth - r.healthBarWidth * (1-(U.shameCount / 7)))
                            k = U.y - f + U.scale + r.nameY - 17 + r.healthBarPad,
                                ve.fillStyle = nt,
                                ve.roundRect(U.x - d - r.healthBarPad - r.healthBarWidth/2, k, r.healthBarWidth + 2 * r.healthBarPad, 17, 5),
                                ve.fill(),
                                k = U.y - f + U.scale + r.nameY + r.healthBarPad - 17 + r.healthBarPad,
                                ve.fillStyle = changeColor({value:U.clowned?U.clownTimer:U.shameCount, maxValue: U.clowned?30:7}, "#c8d4b4", "#d16666"),
                                ve.roundRect(U.x - d - r.healthBarWidth/2, k, U.clowned ? googoogaagaa : gaagaagoogoo, 17 - 2 * r.healthBarPad, 4),
                                ve.fill(),
                                ve.restore();
                            if(U.id && U.isPlayer){
                                ve.textAlign = "center",
                                    ve.fillStyle = changeColor({value:U.clowned?U.clownTimer:U.shameCount, maxValue: U.clowned?30:7}, "#c8d4b4", "#d16666"),
                                    ve.lineJoin = "round",
                                    ve.font = "20px Hammersmith One",
                                    ve.strokeStyle = "rgba(0,0,0,0.35)",
                                    ve.lineWidth = 6,
                                    ve.strokeText(U.clowned? U.clownTimer : U.shameCount,U.x - d,U.y - f + 60),
                                    ve.fillText(U.clowned? U.clownTimer : U.shameCount,U.x - d,U.y - f + 60)
                            }
                        }
                        U.isPlayer && vism.beta && vism.toggle && (b = 48,
                                                                   k = U.x - d - b / 2 + ve.measureText(v).width / 2 + r.crownPad,
                                                                   ve.save(),
                                                                   ve.font = "34px Hammersmith One",
                                                                   ve.fillStyle = "#ff0000",
                                                                   ve.strokeStyle = nt,
                                                                   ve.textBaseline = "middle",
                                                                   ve.textAlign = "center",
                                                                   ve.lineWidth = U.nameScale ? 11 : 8,
                                                                   ve.lineJoin = "round",
                                                                   ve.globalAlpha = cdf(U, A) < 400? 1: 1-((cdf(U, A)-400)/900),
                                                                   ve.strokeText(U.shameCount, k + b / 2, U.y - f - U.scale - r.nameY),
                                                                   ve.fillText(U.shameCount, k + b / 2, U.y - f - U.scale - r.nameY),
                                                                   ve.restore(),
                                                                   ve.save(),
                                                                   k = U.y - f + U.scale + r.nameY - 17 + r.healthBarPad,
                                                                   ve.fillStyle = nt,
                                                                   ve.roundRect(U.x - d - r.healthBarWidth - r.healthBarPad, k, r.healthBarWidth + 2 * r.healthBarPad, 17, 8),
                                                                   ve.fill(),
                                                                   k = U.y - f + U.scale + r.nameY + r.healthBarPad - 17 + r.healthBarPad,
                                                                   ve.fillStyle = U.reloads[U.weapons[0]] ? "#8f815a" : "#8f815a",
                                                                   ve.roundRect(U.x - d - r.healthBarWidth, k, (r.healthBarWidth - r.healthBarWidth * (U.reloads[U.weapons[0]] / l.weapons[U.weapons[0]].speed)), 17 - 2 * r.healthBarPad, 7),
                                                                   ve.fill(),
                                                                   k = U.y - f + U.scale + r.nameY - 17 + r.healthBarPad,
                                                                   ve.fillStyle = nt,
                                                                   ve.roundRect(U.x - d - r.healthBarPad, k, r.healthBarWidth + 2 * r.healthBarPad, 17, 8),
                                                                   ve.fill(),
                                                                   k = U.y - f + U.scale + r.nameY + r.healthBarPad - 17 + r.healthBarPad,
                                                                   ve.fillStyle = U.weapons[1] && U.reloads[U.weapons[1]] ? "#8f815a" : "#8f815a",
                                                                   ve.roundRect(U.x - d, k, (U.weapons[1] ? (r.healthBarWidth * (U.reloads[U.weapons[1]] / l.weapons[U.weapons[1]].speed)) : r.healthBarWidth), 17 - 2 * r.healthBarPad, 7),
                                                                   ve.fill(),
                                                                   ve.restore());
                        U.health > 0 && (ve.save(),
                                         ve.globalAlpha = cdf(U, A) < 400? 1: 1-((cdf(U, A)-400)/900),
                                         ve.fillStyle = nt,
                                         ve.roundRect(U.x - d - r.healthBarWidth - r.healthBarPad, U.y - f + U.scale + r.nameY, 2 * r.healthBarWidth + 2 * r.healthBarPad, 17, 8),
                                         ve.fill(),
                                         ve.fillStyle = U == A || U.team && U.team == A.team ? "#8ecc51" : "#cc5151",
                                         ve.roundRect(U.x - d - r.healthBarWidth, U.y - f + U.scale + r.nameY + r.healthBarPad, 2 * r.healthBarWidth * (U.health / U.maxHealth), 17 - 2 * r.healthBarPad, 7),
                                         ve.fill(),
                                         ve.restore()
                                        );
                        if(U.id && U.isPlayer && !vism.toggle){
                            ve.textAlign = "center",
                                ve.fillStyle = "#fff",
                                ve.lineJoin = "round",
                                ve.font = "20px Hammersmith One",
                                ve.strokeStyle = "rgba(0,0,0,0.55)",
                                ve.lineWidth = 6,
                                ve.strokeText(U.sid,U.x - d,U.y - f - 50),
                                ve.fillText(U.sid,U.x - d,U.y - f - 50)
                        }
                        for (let each of Object.values(autoImg)) {
                            if (U.sid == each.target) {
                                ve.drawImage(each.image, U.x - d - 35, U.y - f - 35, 70, 70);
                            }
                        }
                    }
                for (let U of N) {
                    if (showTrapRadar && U.active && A && U.trap && U.owner.sid == A.sid) {
                        ve.lineCap = "round";
                        ve.strokeStyle = "white";
                        ve.lineWidth = 3;
                        ve.beginPath();
                        ve.moveTo(A.x - d, A.y - f);
                        ve.lineTo(U.x - d, U.y - f);
                        ve.stroke();
                    }
                }
                if(enemy && findSpikeHit.x && findSpikeHit.y){
                    let a = findSpikeHit.canHit
                    ve.save();
                    ve.lineWidth = 5;
                    ve.strokeStyle = a?"rgba(129, 53, 50, .5)":"rgba(117, 153, 191, .5)";
                    ve.fillStyle = a?"rgba(129, 53, 50, .5)":"rgba(117, 153, 191, .2)";
                    en(findSpikeHit.spikePosX - d, findSpikeHit.spikePosY - f, 54, ve);
                    ve.restore();
                }
                for(let i = 9; i < deadPlayer.length; i++){
                    U = deadPlayer[i].obj;
                    let tmpDir = U.dir + U.dirPlus;
                    ve.save();
                    ve.translate(U.x - d, U.y - f);
                    ve.rotate(tmpDir);
                    renderDeadPlayer(U, ve);
                    ve.restore();
                }
                m.update(E, ve, d, f);
                for (let a = 0; a < X.length; ++a)
                    if ((U = X[a]).visible && U.chatCountdown > 0) {
                        U.chatCountdown -= E,
                            U.chatCountdown <= 0 && (U.chatCountdown = 0),
                            ve.font = "32px Hammersmith One";
                        var x = ve.measureText(U.chatMessage);
                        ve.textBaseline = "middle",
                            ve.textAlign = "center",
                            k = U.x - d,
                            y = U.y - U.scale - f - 90;
                        var S = x.width + 17;
                        ve.fillStyle = "rgba(0,0,0,0.2)",
                            ve.roundRect(k - S / 2, y - 23.5, S, 47, 6),
                            ve.fill(),
                            ve.fillStyle = "#fff",
                            ve.fillText(U.chatMessage, k, y)
                    }!
                        function(e) {
                        if (A && A.alive) {
                            Ke.clearRect(0, 0, Ge.width, Ge.height),
                                Ke.strokeStyle = "#fff",
                                Ke.lineWidth = 4;
                            for (var t = 0; t < zt.length; ++t)
                                (Lt = zt[t]).update(Ke, e);
                            for (let U of enemies) {
                                Ke.globalAlpha = 1;
                                Ke.fillStyle = "red";
                                en(U.x / r.mapScale * Ge.width, U.y / r.mapScale * Ge.height, 7, Ke, !0);
                            }
                            Tach.drawWaypointMap(Ke, Ge);
                            if (Ke.globalAlpha = 1,
                                Ke.fillStyle = "#fff",
                                en(A.x / r.mapScale * Ge.width, A.y / r.mapScale * Ge.height, 7, Ke, !0),
                                Ke.fillStyle = "rgba(255,255,255,0.35)",
                                bt)
                                for (t = 0; t < bt.length;)
                                    en(bt[t] / r.mapScale * Ge.width, bt[t + 1] / r.mapScale * Ge.height, 7, Ke, !0),
                                        t += 2;
                            vt && (Ke.fillStyle = "#fc5553",
                                   Ke.font = "34px Hammersmith One",
                                   Ke.textBaseline = "middle",
                                   Ke.textAlign = "center",
                                   Ke.fillText("x", vt.x / r.mapScale * Ge.width, vt.y / r.mapScale * Ge.height)),
                                xt && (Ke.fillStyle = "#fff",
                                       Ke.font = "34px Hammersmith One",
                                       Ke.textBaseline = "middle",
                                       Ke.textAlign = "center",
                                       Ke.fillText("x", xt.x / r.mapScale * Ge.width, xt.y / r.mapScale * Ge.height))
                        }
                    }(E),
                        -1 !== ne.id && Di(ne.startX, ne.startY, ne.currentX, ne.currentY),
                        -1 !== se.id && Di(se.startX, se.startY, se.currentX, se.currentY)
            }(),
                shadowMode && (ve.beginPath(), ve.fillStyle = black, ve.fillRect(0, 0, ae, re), ve.closePath()),
                requestAnimFrame(e)
        }()),
            window.openLink = Pn,
            window.aJoinReq = jt,
            window.follmoo = function() {
            H || (H = !0,
                  T("moofoll", 1))
        },
            window.kickFromClan = At,
            window.sendJoin = Dt,
            window.leaveAlliance = Rt,
            window.createAlliance = Ut,
            window.storeBuy = Xt,
            window.storeEquip = Wt,
            window.showItemInfo = wt,
            window.selectSkinColor = function(e) {
            oe = e,
                Kt()
        },
            window.changeStoreIndex = function(e) {
            Ht != e && (Ht = e,
                        qt())
        },
            window.config = r,
            window.FRVR && window.FRVR.bootstrapper.complete()
    }, function(e, t) {
        ! function(e, t, i) {
            function n(e, t) {
                return typeof e === t
            }
            var s = [],
                o = [],
                a = {
                    _version: "3.5.0",
                    _config: {
                        classPrefix: "",
                        enableClasses: !0,
                        enableJSClass: !0,
                        usePrefixes: !0
                    },
                    _q: [],
                    on: function(e, t) {
                        var i = this;
                        setTimeout((function() {
                            t(i[e])
                        }), 0)
                    },
                    addTest: function(e, t, i) {
                        o.push({
                            name: e,
                            fn: t,
                            options: i
                        })
                    },
                    addAsyncTest: function(e) {
                        o.push({
                            name: null,
                            fn: e
                        })
                    }
                },
                r = function() {};
            r.prototype = a,
                r = new r;
            var c = t.documentElement,
                l = "svg" === c.nodeName.toLowerCase();
            r.addTest("passiveeventlisteners", (function() {
                var t = !1;
                try {
                    var i = Object.defineProperty({}, "passive", {
                        get: function() {
                            t = !0
                        }
                    });
                    e.addEventListener("test", null, i)
                } catch (e) {}
                return t
            })),
                function() {
                var e, t, i, a, c, l;
                for (var h in o)
                    if (o.hasOwnProperty(h)) {
                        if (e = [],
                            (t = o[h]).name && (e.push(t.name.toLowerCase()),
                                                t.options && t.options.aliases && t.options.aliases.length))
                            for (i = 0; i < t.options.aliases.length; i++)
                                e.push(t.options.aliases[i].toLowerCase());
                        for (a = n(t.fn, "function") ? t.fn() : t.fn,
                             c = 0; c < e.length; c++)
                            1 === (l = e[c].split(".")).length ? r[l[0]] = a : (!r[l[0]] || r[l[0]] instanceof Boolean || (r[l[0]] = new Boolean(r[l[0]])),
                                                                                r[l[0]][l[1]] = a),
                                s.push((a ? "" : "no-") + l.join("-"))
                    }
            }(),
                function(e) {
                var t = c.className,
                    i = r._config.classPrefix || "";
                if (l && (t = t.baseVal),
                    r._config.enableJSClass) {
                    var n = new RegExp("(^|\\s)" + i + "no-js(\\s|$)");
                    t = t.replace(n, "$1" + i + "js$2")
                }
                r._config.enableClasses && (t += " " + i + e.join(" " + i),
                                            l ? c.className.baseVal = t : c.className = t)
            }(s),
                delete a.addTest,
                delete a.addAsyncTest;
            for (var h = 0; h < r._q.length; h++)
                r._q[h]();
            e.Modernizr = r
        }(window, document)
    }, function(e, t, i) {
        const {
            Encoder: n,
            Decoder: s
        } = i(37), o = new n, a = new s;
        i(0),
            e.exports = {
            socket: null,
            connected: !1,
            socketId: -1,
            connect: function(e, t, i) {
                if (!this.socket) {
                    var n = this;
                    try {
                        var s = !1,
                            o = e;
                        this.socket = new WebSocket(o),
                            this.socket.binaryType = "arraybuffer",
                            this.socket.onmessage = function(e) {
                            var t = new Uint8Array(e.data),
                                s = a.decode(t),
                                o = s[0];
                            t = s[1],
                                "io-init" == o ? n.socketId = t[0] : i[o].apply(void 0, t)
                        },
                            this.socket.onopen = function() {
                            n.connected = !0,
                                t()
                        },
                            this.socket.onclose = function(e) {
                            n.connected = !1,
                                4001 == e.code ? t("Invalid Connection") : s || t("disconnected")
                        },
                            this.socket.onerror = function(e) {
                            this.socket && this.socket.readyState != WebSocket.OPEN && (s = !0,
                                                                                        console.error("Socket error", arguments),
                                                                                        t("Socket error"))
                        }
                    } catch (e) {
                        console.warn("Socket connection error:", e),
                            t(e)
                    }
                }
            },
            send: function(e) {
                var t = Array.prototype.slice.call(arguments, 1),
                    i = o.encode([e, t]);
                this.socket.send(i)
            },
            socketReady: function() {
                return this.socket && this.connected
            },
            close: function() {
                this.socket && this.socket.close()
            },
        }
    }, function(e, t) {
        var i, n, s = e.exports = {};

        function o() {
            throw new Error("setTimeout has not been defined")
        }

        function a() {
            throw new Error("clearTimeout has not been defined")
        }

        function r(e) {
            if (i === setTimeout)
                return setTimeout(e, 0);
            if ((i === o || !i) && setTimeout)
                return i = setTimeout,
                    setTimeout(e, 0);
            try {
                return i(e, 0)
            } catch (t) {
                try {
                    return i.call(null, e, 0)
                } catch (t) {
                    return i.call(this, e, 0)
                }
            }
        }! function() {
            try {
                i = "function" == typeof setTimeout ? setTimeout : o
            } catch (e) {
                i = o
            }
            try {
                n = "function" == typeof clearTimeout ? clearTimeout : a
            } catch (e) {
                n = a
            }
        }();
        var c, l = [],
            h = !1,
            u = -1;

        function d() {
            h && c && (h = !1,
                       c.length ? l = c.concat(l) : u = -1,
                       l.length && f())
        }

        function f() {
            if (!h) {
                var e = r(d);
                h = !0;
                for (var t = l.length; t;) {
                    for (c = l,
                         l = []; ++u < t;)
                        c && c[u].run();
                    u = -1,
                        t = l.length
                }
                c = null,
                    h = !1,
                    function(e) {
                    if (n === clearTimeout)
                        return clearTimeout(e);
                    if ((n === a || !n) && clearTimeout)
                        return n = clearTimeout,
                            clearTimeout(e);
                    try {
                        n(e)
                    } catch (t) {
                        try {
                            return n.call(null, e)
                        } catch (t) {
                            return n.call(this, e)
                        }
                    }
                }(e)
            }
        }

        function p(e, t) {
            this.fun = e,
                this.array = t
        }

        function g() {}
        s.nextTick = function(e) {
            var t = new Array(arguments.length - 1);
            if (arguments.length > 1)
                for (var i = 1; i < arguments.length; i++)
                    t[i - 1] = arguments[i];
            l.push(new p(e, t)),
                1 !== l.length || h || r(f)
        },
            p.prototype.run = function() {
            this.fun.apply(null, this.array)
        },
            s.title = "browser",
            s.browser = !0,
            s.env = {},
            s.argv = [],
            s.version = "",
            s.versions = {},
            s.on = g,
            s.addListener = g,
            s.once = g,
            s.off = g,
            s.removeListener = g,
            s.removeAllListeners = g,
            s.emit = g,
            s.prependListener = g,
            s.prependOnceListener = g,
            s.listeners = function(e) {
            return []
        },
            s.binding = function(e) {
            throw new Error("process.binding is not supported")
        },
            s.cwd = function() {
            return "/"
        },
            s.chdir = function(e) {
            throw new Error("process.chdir is not supported")
        },
            s.umask = function() {
            return 0
        }
    }, function(e, t) {
        var i = Math.abs,
            n = (Math.cos,
                 Math.sin,
                 Math.pow,
                 Math.sqrt),
            s = (i = Math.abs,
                 Math.atan2),
            o = Math.PI;
        e.exports.randInt = function(e, t) {
            return Math.floor(Math.random() * (t - e + 1)) + e
        },
            e.exports.randFloat = function(e, t) {
            return Math.random() * (t - e + 1) + e
        },
            e.exports.lerp = function(e, t, i) {
            return e + (t - e) * i
        },
            e.exports.decel = function(e, t) {
            return e > 0 ? e = Math.max(0, e - t) : e < 0 && (e = Math.min(0, e + t)),
                e
        },
            e.exports.getDistance = function(e, t, i, s) {
            return n((i -= e) * i + (s -= t) * s)
        },
            e.exports.getDirection = function(e, t, i, n) {
            return s(t - n, e - i)
        },
            e.exports.getAngleDist = function(e, t) {
            var n = i(t - e) % (2 * o);
            return n > o ? 2 * o - n : n
        },
            e.exports.isNumber = function(e) {
            return "number" == typeof e && !isNaN(e) && isFinite(e)
        },
            e.exports.isString = function(e) {
            return e && "string" == typeof e
        },
            e.exports.numberFormat = function(num) {
            let formats = [
                [1e3, "k"],
                [1e6, "m"],
                [1e9, "b"],
                [1e12, "t"],
                [1e15, "q"],
            ];
            for (let i = 0; i < formats.length; i++) {
                let b;
                let a = [formats[i], (b = formats[i + 1]) ? b[0] : Infinity];
                if (num >= a[0][0] && num < a[1]) {
                    return (num / a[0][0]).toFixed(1) + a[0][1];
                }
            }
        },
            e.exports.capitalizeFirst = function(e) {
            return e.charAt(0).toUpperCase() + e.slice(1)
        },
            e.exports.fixTo = function(e, t) {
            return parseFloat(e.toFixed(t))
        },
            e.exports.sortByPoints = function(e, t) {
            return parseFloat(t.points) - parseFloat(e.points)
        },
            e.exports.lineInRect = function(e, t, i, n, s, o, a, r) {
            var c = s,
                l = a;
            if (s > a && (c = a,
                          l = s),
                l > i && (l = i),
                c < e && (c = e),
                c > l)
                return !1;
            var h = o,
                u = r,
                d = a - s;
            if (Math.abs(d) > 1e-7) {
                var f = (r - o) / d,
                    p = o - f * s;
                h = f * c + p,
                    u = f * l + p
            }
            if (h > u) {
                var g = u;
                u = h,
                    h = g
            }
            return u > n && (u = n),
                h < t && (h = t),
                !(h > u)
        },
            e.exports.containsPoint = function(e, t, i) {
            var n = e.getBoundingClientRect(),
                s = n.left + window.scrollX,
                o = n.top + window.scrollY,
                a = n.width,
                r = n.height;
            return t > s && t < s + a && i > o && i < o + r
        },
            e.exports.mousifyTouchEvent = function(e) {
            var t = e.changedTouches[0];
            e.screenX = t.screenX,
                e.screenY = t.screenY,
                e.clientX = t.clientX,
                e.clientY = t.clientY,
                e.pageX = t.pageX,
                e.pageY = t.pageY
        },
            e.exports.hookTouchEvents = function(t, i) {
            var n = !i,
                s = !1;

            function o(i) {
                e.exports.mousifyTouchEvent(i),
                    window.setUsingTouch(!0),
                    n && (i.preventDefault(),
                          i.stopPropagation()),
                    s && (t.onclick && t.onclick(i),
                          t.onmouseout && t.onmouseout(i),
                          s = !1)
            }
            t.addEventListener("touchstart", e.exports.checkTrusted((function(i) {
                e.exports.mousifyTouchEvent(i),
                    window.setUsingTouch(!0),
                    n && (i.preventDefault(),
                          i.stopPropagation()),
                    t.onmouseover && t.onmouseover(i),
                    s = !0
            })), !1),
                t.addEventListener("touchmove", e.exports.checkTrusted((function(i) {
                e.exports.mousifyTouchEvent(i),
                    window.setUsingTouch(!0),
                    n && (i.preventDefault(),
                          i.stopPropagation()),
                    e.exports.containsPoint(t, i.pageX, i.pageY) ? s || (t.onmouseover && t.onmouseover(i),
                                                                         s = !0) : s && (t.onmouseout && t.onmouseout(i),
                                                                                         s = !1)
            })), !1),
                t.addEventListener("touchend", e.exports.checkTrusted(o), !1),
                t.addEventListener("touchcancel", e.exports.checkTrusted(o), !1),
                t.addEventListener("touchleave", e.exports.checkTrusted(o), !1)
        },
            e.exports.removeAllChildren = function(e) {
            for (; e.hasChildNodes();)
                e.removeChild(e.lastChild)
        },
            e.exports.generateElement = function(t) {
            var i = document.createElement(t.tag || "div");

            function n(e, n) {
                t[e] && (i[n] = t[e])
            }
            for (var s in n("text", "textContent"),
                 n("html", "innerHTML"),
                 n("class", "className"),
                 t) {
                switch (s) {
                    case "tag":
                    case "text":
                    case "html":
                    case "class":
                    case "style":
                    case "hookTouch":
                    case "parent":
                    case "children":
                        continue
                }
                i[s] = t[s]
            }
            if (i.onclick && (i.onclick = e.exports.checkTrusted(i.onclick)),
                i.onmouseover && (i.onmouseover = e.exports.checkTrusted(i.onmouseover)),
                i.onmouseout && (i.onmouseout = e.exports.checkTrusted(i.onmouseout)),
                t.style && (i.style.cssText = t.style),
                t.hookTouch && e.exports.hookTouchEvents(i),
                t.parent && t.parent.appendChild(i),
                t.children)
                for (var o = 0; o < t.children.length; o++)
                    i.appendChild(t.children[o]);
            return i
        },
            e.exports.eventIsTrusted = function(e) {
            return !e || "boolean" != typeof e.isTrusted || e.isTrusted
        },
            e.exports.checkTrusted = function(t) {
            return function(i) {
                i && i instanceof Event && e.exports.eventIsTrusted(i) && t(i)
            }
        },
            e.exports.randomString = function(e) {
            for (var t = "", i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", n = 0; n < e; n++)
                t += i.charAt(Math.floor(Math.random() * i.length));
            return t
        },
            e.exports.countInArray = function(e, t) {
            for (var i = 0, n = 0; n < e.length; n++)
                e[n] === t && i++;
            return i
        }
    }, function(e, t) {
        e.exports.AnimText = function() {
            this.init = function(e, t, i, n, s, o, a) {
                this.visual = i == 51
                this.building = i == 30
                if(this.building){
                    this.x = e;
                    this.y = t;
                    this.color = a;
                    this.scale = i;
                    this.weight = 50
                    this.startScale = this.scale * .8;
                    this.maxScale = i * 1.5;
                    this.scaleSpeed = .7;
                    this.speed = n;
                    this.life = s;
                    this.maxLife = s
                    this.text = o;
                    this.movSpeed = 0;
                    (this.movAngle = false);
                } else if (this.visual) {
                    this.x = e;
                    this.y = t;
                    this.color = a;
                    this.scale = i;
                    this.weight = 50
                    this.startScale = this.scale * .8;
                    this.maxScale = i * 1.5;
                    this.scaleSpeed = .7;
                    this.speed = n;
                    this.life = s;
                    this.maxLife = s
                    this.text = o;
                    this.movSpeed = Math.random() * 1 + 1;
                    (this.movAngle = Math.random() * 1 < .5);
                } else {
                    this.x = e,
                        this.y = t,
                        this.color = a,
                        this.scale = i,
                        this.startScale = this.scale,
                        this.maxScale = 1.5 * i,
                        this.scaleSpeed = .7,
                        this.speed = n,
                        this.life = s,
                        this.text = o
                }
            },
                this.update = function(e) {
                if(this.building){
                    if (this.life) {
                        this.life -= e;
                        if (this.scaleSpeed != -0.35) {
                            this.y -= this.speed * e;
                            this.movAngle ? (this.x -= this.speed * e * (this.movSpeed)) : (this.x += this.speed * e * (this.movSpeed));
                        } else {
                            this.y += this.speed * e;
                        }
                        this.scale += this.scaleSpeed * (e / 4.5);
                        this.scale = Math.max(this.scale, this.startScale);
                        this.speed < this.speedMax && (this.speed += this.speedMax * .01);
                        if (this.scale >= this.maxScale) {
                            this.scale = this.maxScale;
                            this.scaleSpeed *= -.5;
                            this.speed = this.speed * .5;
                        };
                        this.life <= 0 && (this.life = 0)
                    };
                } else if (this.visual) {
                    if (this.life) {
                        this.life -= e;
                        if (this.scaleSpeed != -0.35) {
                            this.y -= this.speed * e;
                            this.movAngle ? (this.x -= this.speed * e * (this.movSpeed)) : (this.x += this.speed * e * (this.movSpeed));
                        } else {
                            this.y += this.speed * e;
                        }
                        this.scale += this.scaleSpeed * (e / 4.5);
                        this.scale = Math.max(this.scale, this.startScale);
                        this.speed < this.speedMax && (this.speed += this.speedMax * .01);
                        if (this.scale >= this.maxScale) {
                            this.scale = this.maxScale;
                            this.scaleSpeed *= -.5;
                            this.speed = this.speed * .5;
                        };
                        this.life <= 0 && (this.life = 0)
                    };
                } else {
                    this.life && (this.life -= e,
                                  this.y -= this.speed * e,
                                  this.scale += this.scaleSpeed * e,
                                  this.scale >= this.maxScale ? (this.scale = this.maxScale,
                                                                 this.scaleSpeed *= -1) : this.scale <= this.startScale && (this.scale = this.startScale,
                                                                                                                            this.scaleSpeed = 0),
                                  this.life <= 0 && (this.life = 0))
                }
            },
                this.render = function(e, t, i) {
                if(this.building){
                    e.save();
                    e.lineWidth = 10;
                    e.lineJoin = "round",
                        e.strokeStyle = "#3d3f42";
                    e.fillStyle = this.color;
                    e.globalAlpha = this.life / this.maxLife * 2;
                    e.font = this.scale + "px Hammersmith One";
                    e.strokeText(this.text, this.x - t, this.y - i);
                    e.fillText(this.text, this.x - t, this.y - i);
                    e.globalAlpha = 1;
                    e.restore();
                } else if (this.visual) {
                    e.save();
                    e.lineWidth = 10;
                    e.strokeStyle = "#3d3f42";
                    e.fillStyle = this.color;
                    e.globalAlpha = this.life / this.maxLife * 2;
                    e.font = this.scale + "px Hammersmith One";
                    e.fillText(this.text, this.x - t, this.y - i);
                    e.globalAlpha = 1;
                    e.restore();
                } else {
                    e.fillStyle = this.color,
                        e.font = this.scale + "px Hammersmith One",
                        e.fillText(this.text, this.x - t, this.y - i)
                }
            }
        },
            e.exports.TextManager = function() {
            this.texts = [],
                this.update = function(e, t, i, n) {
                t.textBaseline = "middle",
                    t.textAlign = "center";
                for (var s = 0; s < this.texts.length; ++s)
                    this.texts[s].life && (this.texts[s].update(e),
                                           this.texts[s].render(t, i, n))
            },
                this.showText = function(t, i, n, s, o, a, r) {
                for (var c, l = 0; l < this.texts.length; ++l)
                    if (!this.texts[l].life) {
                        c = this.texts[l];
                        break
                    }
                c || (c = new e.exports.AnimText,
                      this.texts.push(c)),
                    c.init(t, i, n, s, o, a, r)
            }
        }
    }, function(e, t) {
        e.exports = function(e) {
            this.sid = e,
                this.init = function(e, t, i, n, s, o, a) {
                o = o || {},
                    this.sentTo = {},
                    this.gridLocations = [],
                    this.active = !0,
                    this.doUpdate = o.doUpdate,
                    this.x = e,
                    this.y = t,
                    this.dir = i,
                    this.lastWiggle = 0,
                    this.foundHitter = false;
                this.xWiggle = 0,
                    this.yWiggle = 0,
                    this.scale = n,
                    this.type = s,
                    this.id = o.id,
                    this.owner = a,
                    this.name = o.name,
                    this.isItem = null != this.id,
                    this.group = o.group,
                    this.health = o.health,
                    (this.healthMov = o.health),
                    this.layer = 2,
                    null != this.group ? this.layer = this.group.layer : 0 == this.type ? this.layer = 3 : 2 == this.type ? this.layer = 0 : 4 == this.type && (this.layer = -1),
                    this.colDiv = o.colDiv || 1,
                    this.blocker = o.blocker,
                    this.ignoreCollision = o.ignoreCollision,
                    this.dontGather = o.dontGather,
                    this.hideFromEnemy = o.hideFromEnemy,
                    this.friction = o.friction,
                    this.projDmg = o.projDmg,
                    this.dmg = o.dmg,
                    this.pDmg = o.pDmg,
                    this.pps = o.pps,
                    this.zIndex = o.zIndex || 0,
                    this.turnSpeed = o.turnSpeed,
                    this.req = o.req,
                    this.trap = o.trap,
                    this.healCol = o.healCol,
                    this.teleport = o.teleport,
                    this.boostSpeed = o.boostSpeed,
                    this.projectile = o.projectile,
                    this.shootRange = o.shootRange,
                    this.shootRate = o.shootRate,
                    this.shootCount = this.shootRate,
                    this.spawnPoint = o.spawnPoint
            },
                this.changeHealth = function(e, t) {
                return this.health += e,
                    this.health <= 0
            },
                this.getScale = function(e, t) {
                return e = e || 1,
                    this.scale * (this.isItem || 2 == this.type || 3 == this.type || 4 == this.type ? 1 : .6 * e) * (t ? 1 : this.colDiv)
            },
                this.visibleToPlayer = function(e) {
                return !this.hideFromEnemy || this.owner && (this.owner == e || this.owner.team && e.team == this.owner.team)
            },
                this.update = function(e) {
                if(this.health != this.healthMov){
                    this.health < this.healthMov ? (this.healthMov -= 7.5) : (this.healthMov += 7.5);
                    if(Math.abs(this.health - this.healthMov) < 7.5) this.healthMov = this.health;
                };
                this.active && (this.xWiggle && (this.xWiggle *= Math.pow(.99, e)),
                                this.yWiggle && (this.yWiggle *= Math.pow(.99, e)),
                                this.turnSpeed && (this.dir += this.turnSpeed * e * 0.3))
            }
        }
    }, function(e, t) {
        e.exports.groups = [{
            id: 0,
            name: "food",
            layer: 0
        }, {
            id: 1,
            name: "walls",
            place: !0,
            limit: 30,
            layer: 0
        }, {
            id: 2,
            name: "spikes",
            place: !0,
            limit: 15,
            layer: 0
        }, {
            id: 3,
            name: "mill",
            place: !0,
            limit: 7,
            layer: 1
        }, {
            id: 4,
            name: "mine",
            place: !0,
            limit: 1,
            layer: 0
        }, {
            id: 5,
            name: "trap",
            place: !0,
            limit: 6,
            layer: -1
        }, {
            id: 6,
            name: "booster",
            place: !0,
            limit: 12,
            layer: -1
        }, {
            id: 7,
            name: "turret",
            place: !0,
            limit: 2,
            layer: 1
        }, {
            id: 8,
            name: "watchtower",
            place: !0,
            limit: 12,
            layer: 1
        }, {
            id: 9,
            name: "buff",
            place: !0,
            limit: 4,
            layer: -1
        }, {
            id: 10,
            name: "spawn",
            place: !0,
            limit: 1,
            layer: -1
        }, {
            id: 11,
            name: "sapling",
            place: !0,
            limit: 2,
            layer: 0
        }, {
            id: 12,
            name: "blocker",
            place: !0,
            limit: 3,
            layer: -1
        }, {
            id: 13,
            name: "teleporter",
            place: !0,
            limit: 2,
            layer: -1
        }],
            t.projectiles = [{
                indx: 0,
                layer: 0,
                src: "arrow_1",
                dmg: 25,
                speed: 1.6,
                scale: 103,
                range: 1e3
            }, {
                indx: 1,
                layer: 1,
                dmg: 25,
                range: 700,
                speed: 1.5,
                scale: 20
            }, {
                indx: 0,
                layer: 0,
                src: "arrow_1",
                dmg: 35,
                speed: 2.5,
                scale: 103,
                range: 1200
            }, {
                indx: 0,
                layer: 0,
                src: "arrow_1",
                dmg: 30,
                speed: 2,
                scale: 103,
                range: 1200
            }, {
                indx: 1,
                layer: 1,
                dmg: 16,
                scale: 20
            }, {
                indx: 0,
                layer: 0,
                src: "bullet_1",
                dmg: 50,
                speed: 3.6,
                scale: 160,
                range: 1400
            }],
            t.weapons = [{
                id: 0,
                type: 0,
                name: "tool hammer",
                desc: "tool for gathering all resources",
                src: "hammer_1",
                length: 140,
                width: 140,
                xOff: -3,
                yOff: 18,
                dmg: 25,
                range: 65,
                gather: 1,
                speed: 300
            }, {
                id: 1,
                type: 0,
                age: 2,
                name: "hand axe",
                desc: "gathers resources at a higher rate",
                src: "axe_1",
                length: 140,
                width: 140,
                xOff: 3,
                yOff: 24,
                dmg: 30,
                spdMult: 1,
                range: 70,
                gather: 2,
                speed: 400
            }, {
                id: 2,
                type: 0,
                age: 8,
                pre: 1,
                name: "great axe",
                desc: "deal more damage and gather more resources",
                src: "great_axe_1",
                length: 140,
                width: 140,
                xOff: -8,
                yOff: 25,
                dmg: 35,
                spdMult: 1,
                range: 75,
                gather: 4,
                speed: 400
            }, {
                id: 3,
                type: 0,
                age: 2,
                name: "short sword",
                desc: "increased attack power but slower move speed",
                src: "sword_1",
                iPad: 1.3,
                length: 130,
                width: 210,
                xOff: -8,
                yOff: 46,
                dmg: 35,
                spdMult: 0.85,
                range: 110,
                gather: 1,
                speed: 300
            }, {
                id: 4,
                type: 0,
                age: 8,
                pre: 3,
                name: "katana",
                desc: "greater range and damage",
                src: "samurai_1",
                iPad: 1.3,
                length: 130,
                width: 210,
                xOff: -8,
                yOff: 59,
                dmg: 40,
                spdMult: 0.8,
                range: 118,
                gather: 1,
                speed: 300
            }, {
                id: 5,
                type: 0,
                age: 2,
                name: "polearm",
                desc: "long range melee weapon",
                src: "spear_1",
                iPad: 1.3,
                length: 130,
                width: 210,
                xOff: -8,
                yOff: 53,
                dmg: 45,
                knock: 0.2,
                spdMult: 0.82,
                range: 142,
                gather: 1,
                speed: 700
            }, {
                id: 6,
                type: 0,
                age: 2,
                name: "bat",
                desc: "fast long range melee weapon",
                src: "bat_1",
                iPad: 1.3,
                length: 110,
                width: 180,
                xOff: -8,
                yOff: 53,
                dmg: 20,
                knock: 0.7,
                range: 110,
                gather: 1,
                speed: 300
            }, {
                id: 7,
                type: 0,
                age: 2,
                name: "daggers",
                desc: "really fast short range weapon",
                src: "dagger_1",
                iPad: 0.8,
                length: 110,
                width: 110,
                xOff: 18,
                yOff: 0,
                dmg: 20,
                knock: 0.1,
                range: 65,
                gather: 1,
                hitSlow: 0.1,
                spdMult: 1.13,
                speed: 100
            }, {
                id: 8,
                type: 0,
                age: 2,
                name: "stick",
                desc: "great for gathering but very weak",
                src: "stick_1",
                length: 140,
                width: 140,
                xOff: 3,
                yOff: 24,
                dmg: 1,
                spdMult: 1,
                range: 70,
                gather: 7,
                speed: 400
            }, {
                id: 9,
                type: 1,
                age: 6,
                name: "hunting bow",
                desc: "bow used for ranged combat and hunting",
                src: "bow_1",
                req: ["wood", 4],
                length: 120,
                width: 120,
                xOff: -6,
                yOff: 0,
                projectile: 0,
                spdMult: 0.75,
                speed: 600
            }, {
                id: 10,
                type: 1,
                age: 6,
                name: "great hammer",
                desc: "hammer used for destroying structures",
                src: "great_hammer_1",
                length: 140,
                width: 140,
                xOff: -9,
                yOff: 25,
                dmg: 10,
                spdMult: 0.88,
                range: 75,
                sDmg: 7.5,
                gather: 1,
                speed: 400
            }, {
                id: 11,
                type: 1,
                age: 6,
                name: "wooden shield",
                desc: "blocks projectiles and reduces melee damage",
                src: "shield_1",
                length: 120,
                width: 120,
                shield: 0.2,
                xOff: 6,
                yOff: 0,
                spdMult: 0.7
            }, {
                id: 12,
                type: 1,
                age: 8,
                pre: 9,
                name: "crossbow",
                desc: "deals more damage and has greater range",
                src: "crossbow_1",
                req: ["wood", 5],
                aboveHand: true,
                armS: 0.75,
                length: 120,
                width: 120,
                xOff: -4,
                yOff: 0,
                projectile: 2,
                spdMult: 0.7,
                speed: 700
            }, {
                id: 13,
                type: 1,
                age: 9,
                pre: 12,
                name: "repeater crossbow",
                desc: "high firerate crossbow with reduced damage",
                src: "crossbow_2",
                req: ["wood", 10],
                aboveHand: true,
                armS: 0.75,
                length: 120,
                width: 120,
                xOff: -4,
                yOff: 0,
                projectile: 3,
                spdMult: 0.7,
                speed: 230
            }, {
                id: 14,
                type: 1,
                age: 6,
                name: "mc grabby",
                desc: "steals resources from enemies",
                src: "grab_1",
                length: 130,
                width: 210,
                xOff: -8,
                yOff: 53,
                dmg: 0,
                steal: 250,
                knock: 0.2,
                spdMult: 1.05,
                range: 125,
                gather: 0,
                speed: 700
            }, {
                id: 15,
                type: 1,
                age: 9,
                pre: 12,
                name: "musket",
                desc: "slow firerate but high damage and range",
                src: "musket_1",
                req: ["stone", 10],
                aboveHand: true,
                rec: 0.35,
                armS: 0.6,
                hndS: 0.3,
                hndD: 1.6,
                length: 205,
                width: 205,
                xOff: 25,
                yOff: 0,
                projectile: 5,
                hideProjectile: true,
                spdMult: 0.6,
                speed: 1500
            }],
            e.exports.list = [{
                group: e.exports.groups[0],
                name: "apple",
                desc: "restores 20 health when consumed",
                req: ["food", 10],
                consume: 20,
                scale: 22,
                holdOffset: 15
            }, {
                age: 3,
                group: e.exports.groups[0],
                name: "cookie",
                desc: "restores 40 health when consumed",
                req: ["food", 15],
                consume: 40,
                scale: 27,
                holdOffset: 15
            }, {
                age: 7,
                group: e.exports.groups[0],
                name: "cheese",
                desc: "restores 30 health and another 50 over 5 seconds",
                req: ["food", 25],
                consume: 35,
                scale: 27,
                holdOffset: 15
            }, {
                group: e.exports.groups[1],
                name: "wood wall",
                desc: "provides protection for your village",
                req: ["wood", 10],
                projDmg: true,
                health: 380,
                scale: 50,
                holdOffset: 20,
                placeOffset: -5
            }, {
                age: 3,
                group: e.exports.groups[1],
                name: "stone wall",
                desc: "provides improved protection for your village",
                req: ["stone", 25],
                health: 900,
                scale: 50,
                holdOffset: 20,
                placeOffset: -5
            }, {
                age: 7,
                pre: 1,
                group: e.exports.groups[1],
                name: "castle wall",
                desc: "provides powerful protection for your village",
                req: ["stone", 35],
                health: 1500,
                scale: 52,
                holdOffset: 20,
                placeOffset: -5
            }, {
                group: e.exports.groups[2],
                name: "spikes",
                desc: "damages enemies when they touch them",
                req: ["wood", 20, "stone", 5],
                health: 400,
                dmg: 20,
                scale: 49,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5
            }, {
                age: 5,
                group: e.exports.groups[2],
                name: "greater spikes",
                desc: "damages enemies when they touch them",
                req: ["wood", 30, "stone", 10],
                health: 500,
                dmg: 35,
                scale: 52,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5
            }, {
                age: 9,
                pre: 1,
                group: e.exports.groups[2],
                name: "poison spikes",
                desc: "poisons enemies when they touch them",
                req: ["wood", 35, "stone", 15],
                health: 600,
                dmg: 30,
                pDmg: 5,
                scale: 52,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5
            }, {
                age: 9,
                pre: 2,
                group: e.exports.groups[2],
                name: "spinning spikes",
                desc: "damages enemies when they touch them",
                req: ["wood", 30, "stone", 20],
                health: 500,
                dmg: 45,
                turnSpeed: 0.003,
                scale: 52,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5
            }, {
                group: e.exports.groups[3],
                name: "windmill",
                desc: "generates gold over time",
                req: ["wood", 50, "stone", 10],
                health: 400,
                pps: 1,
                turnSpeed: 0.0016,
                spritePadding: 25,
                iconLineMult: 12,
                scale: 45,
                holdOffset: 20,
                placeOffset: 5
            }, {
                age: 5,
                pre: 1,
                group: e.exports.groups[3],
                name: "faster windmill",
                desc: "generates more gold over time",
                req: ["wood", 60, "stone", 20],
                health: 500,
                pps: 1.5,
                turnSpeed: 0.0025,
                spritePadding: 25,
                iconLineMult: 12,
                scale: 47,
                holdOffset: 20,
                placeOffset: 5
            }, {
                age: 8,
                pre: 1,
                group: e.exports.groups[3],
                name: "power mill",
                desc: "generates more gold over time",
                req: ["wood", 100, "stone", 50],
                health: 800,
                pps: 2,
                turnSpeed: 0.005,
                spritePadding: 25,
                iconLineMult: 12,
                scale: 47,
                holdOffset: 20,
                placeOffset: 5
            }, {
                age: 5,
                group: e.exports.groups[4],
                type: 2,
                name: "mine",
                desc: "allows you to mine stone",
                req: ["wood", 20, "stone", 100],
                iconLineMult: 12,
                scale: 65,
                holdOffset: 20,
                placeOffset: 0
            }, {
                age: 5,
                group: e.exports.groups[11],
                type: 0,
                name: "sapling",
                desc: "allows you to farm wood",
                req: ["wood", 150],
                iconLineMult: 12,
                colDiv: 0.5,
                scale: 110,
                holdOffset: 50,
                placeOffset: -15
            }, {
                age: 4,
                group: e.exports.groups[5],
                name: "pit trap",
                desc: "pit that traps enemies if they walk over it",
                req: ["wood", 30, "stone", 30],
                trap: true,
                ignoreCollision: true,
                hideFromEnemy: true,
                health: 500,
                colDiv: 0.2,
                scale: 50,
                holdOffset: 20,
                placeOffset: -5
            }, {
                age: 4,
                group: e.exports.groups[6],
                name: "boost pad",
                desc: "provides boost when stepped on",
                req: ["stone", 20, "wood", 5],
                ignoreCollision: true,
                boostSpeed: 1.5,
                health: 150,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5
            }, {
                age: 7,
                group: e.exports.groups[7],
                doUpdate: true,
                name: "turret",
                desc: "defensive structure that shoots at enemies",
                req: ["wood", 200, "stone", 150],
                health: 800,
                projectile: 1,
                shootRange: 700,
                shootRate: 2200,
                scale: 43,
                holdOffset: 20,
                placeOffset: -5
            }, {
                age: 7,
                group: e.exports.groups[8],
                name: "platform",
                desc: "platform to shoot over walls and cross over water",
                req: ["wood", 20],
                ignoreCollision: true,
                zIndex: 1,
                health: 300,
                scale: 43,
                holdOffset: 20,
                placeOffset: -5
            }, {
                age: 7,
                group: e.exports.groups[9],
                name: "healing pad",
                desc: "standing on it will slowly heal you",
                req: ["wood", 30, "food", 10],
                ignoreCollision: true,
                healCol: 15,
                health: 400,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5
            }, {
                age: 9,
                group: e.exports.groups[10],
                name: "spawn pad",
                desc: "you will spawn here when you die but it will dissapear",
                req: ["wood", 100, "stone", 100],
                health: 400,
                ignoreCollision: true,
                spawnPoint: true,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5
            }, {
                age: 7,
                group: e.exports.groups[12],
                name: "blocker",
                desc: "blocks building in radius",
                req: ["wood", 30, "stone", 25],
                ignoreCollision: true,
                blocker: 300,
                health: 400,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5
            }, {
                age: 7,
                group: e.exports.groups[13],
                name: "teleporter",
                desc: "teleports you to a random point on the map",
                req: ["wood", 60, "stone", 60],
                ignoreCollision: true,
                teleport: true,
                health: 200,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5
            }];
        e.exports.projFounds = [];
        for (var i = 0; i < e.exports.list.length; ++i)
            e.exports.list[i].id = i,
                e.exports.list[i].pre && (e.exports.list[i].pre = i - e.exports.list[i].pre)
    }, function(e, t) {
        e.exports = {}
    }, function(e, t) {
        var i = Math.floor,
            n = Math.abs,
            s = Math.cos,
            o = Math.sin,
            a = (Math.pow,
                 Math.sqrt);
        e.exports = function(e, t, r, c, l, h) {
            var u, d;
            this.objects = t,
                this.grids = {},
                this.updateObjects = [];
            var f = c.mapScale / c.colGrid;
            this.setObjectGrids = function(e) {
                for (var t = Math.min(c.mapScale, Math.max(0, e.x)), i = Math.min(c.mapScale, Math.max(0, e.y)), n = 0; n < c.colGrid; ++n) {
                    u = n * f;
                    for (var s = 0; s < c.colGrid; ++s)
                        d = s * f,
                            t + e.scale >= u && t - e.scale <= u + f && i + e.scale >= d && i - e.scale <= d + f && (this.grids[n + "_" + s] || (this.grids[n + "_" + s] = []),
                                                                                                                     this.grids[n + "_" + s].push(e),
                                                                                                                     e.gridLocations.push(n + "_" + s))
                }
            },
                this.removeObjGrid = function(e) {
                for (var t, i = 0; i < e.gridLocations.length; ++i)
                    (t = this.grids[e.gridLocations[i]].indexOf(e)) >= 0 && this.grids[e.gridLocations[i]].splice(t, 1)
            },
                this.disableObj = function(e) {
                if (e.active = !1,
                    h) {
                    e.owner && e.pps && (e.owner.pps -= e.pps),
                        this.removeObjGrid(e);
                    var t = this.updateObjects.indexOf(e);
                    t >= 0 && this.updateObjects.splice(t, 1)
                }
            },
                this.hitObj = function(e, t) {
                for (var i = 0; i < l.length; ++i)
                    l[i].active && (e.sentTo[l[i].id] && (e.active ? l[i].canSee(e) && h.send(l[i].id, "8", r.fixTo(t, 1), e.sid) : h.send(l[i].id, "12", e.sid)),
                                    e.active || e.owner != l[i] || l[i].changeItemCount(e.group.id, -1))
            };
            var p, g, m = [];
            this.getGridArrays = function(e, t, n) {
                u = i(e / f),
                    d = i(t / f),
                    m.length = 0;
                try {
                    this.grids[u + "_" + d] && m.push(this.grids[u + "_" + d]),
                        e + n >= (u + 1) * f && ((p = this.grids[u + 1 + "_" + d]) && m.push(p),
                                                 d && t - n <= d * f ? (p = this.grids[u + 1 + "_" + (d - 1)]) && m.push(p) : t + n >= (d + 1) * f && (p = this.grids[u + 1 + "_" + (d + 1)]) && m.push(p)),
                        u && e - n <= u * f && ((p = this.grids[u - 1 + "_" + d]) && m.push(p),
                                                d && t - n <= d * f ? (p = this.grids[u - 1 + "_" + (d - 1)]) && m.push(p) : t + n >= (d + 1) * f && (p = this.grids[u - 1 + "_" + (d + 1)]) && m.push(p)),
                        t + n >= (d + 1) * f && (p = this.grids[u + "_" + (d + 1)]) && m.push(p),
                        d && t - n <= d * f && (p = this.grids[u + "_" + (d - 1)]) && m.push(p)
                } catch (e) {}
                return m
            },
                this.add = function(i, n, s, o, a, r, c, l, u) {
                g = null;
                for (var d = 0; d < t.length; ++d)
                    if (t[d].sid == i) {
                        g = t[d];
                        break
                    }
                if (!g)
                    for (d = 0; d < t.length; ++d)
                        if (!t[d].active) {
                            g = t[d];
                            break
                        }
                g || (g = new e(i),
                      t.push(g)),
                    l && (g.sid = i),
                    g.init(n, s, o, a, r, c, u),
                    h && (this.setObjectGrids(g),
                          g.doUpdate && this.updateObjects.push(g))
                Tach.addBuilding(g)
            },
                this.disableBySid = function(e) {
                for (var i = 0; i < t.length; ++i)
                    if (t[i].sid == e) {
                        this.disableObj(t[i]);
                        break
                    }
            },
                this.removeAllItems = function(e, i) {
                for (var n = 0; n < t.length; ++n)
                    t[n].active && t[n].owner && t[n].owner.sid == e && this.disableObj(t[n]);
                i && i.broadcast("13", e)
            },
                this.fetchSpawnObj = function(e) {
                for (var i = null, n = 0; n < t.length; ++n)
                    if ((g = t[n]).active && g.owner && g.owner.sid == e && g.spawnPoint) {
                        i = [g.x, g.y],
                            this.disableObj(g),
                            h.broadcast("12", g.sid),
                            g.owner && g.owner.changeItemCount(g.group.id, -1);
                        break
                    }
                return i
            },
                this.checkItemLocation = function(e, i, n, s, o, a, l) {
                for (var h of t) {
                    var u = h.blocker ? h.blocker : h.getScale(s, h.isItem);
                    if (h.active && r.getDistance(e, i, h.x, h.y) < n + u) return h;
                }
                return !(!a && 18 != o && i >= c.mapScale / 2 - c.riverWidth / 2 && i <= c.mapScale / 2 + c.riverWidth / 2)
            },
                this.addProjectile = function(e, t, i, n, s) {
                for (var o, a = items.projectiles[s], c = 0; c < projectiles.length; ++c)
                    if (!projectiles[c].active) {
                        o = projectiles[c];
                        break
                    }
                o || (o = new Projectile(l, r),
                      projectiles.push(o)),
                    o.init(s, e, t, i, a.speed, n, a.scale)
            },
                this.checkCollision = function(e, t, i) {
                i = i || 1;
                var l = e.x - t.x,
                    h = e.y - t.y,
                    u = e.scale + t.scale;
                if (n(l) <= u || n(h) <= u) {
                    u = e.scale + (t.getScale ? t.getScale() : t.scale);
                    var d = a(l * l + h * h) - u;
                    if (d <= 0) {
                        if (t.ignoreCollision)
                            !t.trap || e.noTrap || t.owner == e || t.owner && t.owner.team && t.owner.team == e.team ? t.boostSpeed ? (e.xVel += i * t.boostSpeed * (t.weightM || 1) * s(t.dir),
                                                                                                                                       e.yVel += i * t.boostSpeed * (t.weightM || 1) * o(t.dir)) : t.healCol ? e.healCol = t.healCol : t.teleport && (e.x = r.randInt(0, c.mapScale),
                                    e.y = r.randInt(0, c.mapScale)) : (e.lockMove = !0,
                                                                       t.hideFromEnemy = !1);
                        else {
                            var f = r.getDirection(e.x, e.y, t.x, t.y);
                            if (r.getDistance(e.x, e.y, t.x, t.y),
                                t.isPlayer ? (d = -1 * d / 2,
                                              e.x += d * s(f),
                                              e.y += d * o(f),
                                              t.x -= d * s(f),
                                              t.y -= d * o(f)) : (e.x = t.x + u * s(f),
                                                                  e.y = t.y + u * o(f),
                                                                  e.xVel *= .75,
                                                                  e.yVel *= .75),
                                t.dmg && t.owner != e && (!t.owner || !t.owner.team || t.owner.team != e.team)) {
                                e.changeHealth(-t.dmg, t.owner, t);
                                var p = 1.5 * (t.weightM || 1);
                                e.xVel += p * s(f),
                                    e.yVel += p * o(f),
                                    !t.pDmg || e.skin && e.skin.poisonRes || (e.dmgOverTime.dmg = t.pDmg,
                                                                              e.dmgOverTime.time = 5,
                                                                              e.dmgOverTime.doer = t.owner),
                                    e.colDmg && t.health && (t.changeHealth(-e.colDmg) && this.disableObj(t),
                                                             this.hitObj(t, r.getDirection(e.x, e.y, t.x, t.y)))
                            }
                        }
                        return t.zIndex > e.zIndex && (e.zIndex = t.zIndex),
                            !0
                    }
                }
                return !1
            }
        }
    }, function(e, t, i) {
        var n = new(i(13));
        n.addWords("jew", "black", "baby", "child", "white", "porn", "pedo", "trump", "clinton", "hitler", "nazi", "gay", "pride", "sex", "pleasure", "touch", "poo", "kids", "rape", "white power", "nigga", "nig nog", "doggy", "rapist", "boner", "nigger", "nigg", "finger", "nogger", "nagger", "nig", "fag", "gai", "pole", "stripper", "penis", "vagina", "pussy", "nazi", "hitler", "stalin", "burn", "chamber", "cock", "peen", "dick", "spick", "nieger", "die", "satan", "n|ig", "nlg", "cunt", "c0ck", "fag", "lick", "condom", "anal", "shit", "phile", "little", "kids", "free KR", "tiny", "sidney", "ass", "kill", ".io", "(dot)", "[dot]", "mini", "whiore", "whore", "faggot", "github", "1337", "666", "satan", "senpa", "discord", "d1scord", "mistik", ".io", "senpa.io", "sidney", "sid", "senpaio", "vries", "asa");
        var s = Math.abs,
            o = Math.cos,
            a = Math.sin,
            r = Math.pow,
            c = Math.sqrt;
        e.exports = function(e, t, i, l, h, u, d, f, p, g, m, y, k, w) {
            this.id = e;
            this.sid = t;
            this.tmpScore = 0;
            this.team = null;
            this.skinIndex = 0;
            this.tailIndex = 0;
            this.hitTime = 0;
            this.lastBleed = {
                amount: 0,
                time: 0,
                healed: true,
            };
            this.lastRegen = {
                amount: 0,
                time: 0,
            };
            this.tails = {};
            for (let v = 0; v < m.length; ++v) {
                m[v].price <= 0 && (this.tails[m[v].id] = 1);
            }
            this.skins = {};
            for (let v = 0; v < g.length; ++v) {
                g[v].price <= 0 && (this.skins[g[v].id] = 1);
            }
            this.points = 0;
            this.dt = 0;
            this.hidden = !1;
            this.itemCounts = {};
            this.isPlayer = !0;
            this.pps = 0;
            this.moveDir = void 0;
            this.skinRot = 0;
            this.lastPing = 0;
            this.iconIndex = 0;
            this.skinColor = 0;
            this.spawn = function(e) {
                this.active = !0;
                this.alive = !0;
                this.lockMove = !1;
                this.lockDir = !1;
                this.minimapCounter = 0;
                this.chatCountdown = 0;
                this.shameCount = 0;
                this.shameTimer = 0;
                this.sentTo = {};
                this.gathering = 0;
                this.autoGather = 0;
                this.animTime = 0;
                this.animSpeed = 0;
                this.mouseState = 0;
                this.buildIndex = -1;
                this.weaponIndex = 0;
                this.dmgOverTime = {
                    amount: 0,
                    time: -1,
                    startTime: 0,
                };
                this.noMovTimer = 0;
                this.maxXP = 300;
                this.XP = 0;
                this.age = 1;
                this.kills = 0;
                this.upgrAge = 2;
                this.upgradePoints = 0;
                this.x = 0;
                this.y = 0;
                this.zIndex = 0;
                this.xVel = 0;
                this.yVel = 0;
                this.slowMult = 1;
                this.dir = 0;
                this.dirPlus = 0;
                this.targetDir = 0;
                this.targetAngle = 0;
                this.maxHealth = 100;
                this.health = this.maxHealth;
                (this.healthMov = 100);
                this.scale = i.playerScale;
                this.speed = i.playerSpeed;
                this.resetMoveDir();
                this.resetResources(e);
                this.items = [0, 3, 6, 10];
                this.weapons = [0];
                this.inTrap = null;
                this.shootCount = 0;
                this.weaponXP = [];
                this.variants = [];
                this.reloads = [];
                new Array(16).fill(0).forEach(() => this.reloads.push(0));
                new Array(16).fill(0).forEach(() => this.variants.push(i.weaponVariants[0]));
            };
            this.resetMoveDir = function() {
                this.moveDir = void 0
            };
            this.resetResources = function(e) {
                for (var t = 0; t < i.resourceTypes.length; ++t)
                    this[i.resourceTypes[t]] = e ? 100 : 0
            },
                this.addItem = function(e) {
                var t = p.list[e];
                if (t) {
                    for (var i = 0; i < this.items.length; ++i)
                        if (p.list[this.items[i]].group == t.group)
                            return this.buildIndex == this.items[i] && (this.buildIndex = e),
                                this.items[i] = e,
                                !0;
                    return this.items.push(e),
                        !0
                }
                return !1
            },
                this.setUserData = function(e) {
                if (e) {
                    this.name = "unknown";
                    var t = e.name + "",
                        s = !1,
                        o = (t = (t = (t = (t = t.slice(0, i.maxNameLength)).replace(/[^\w:\(\)\/? -]+/gim, " ")).replace(/[^\x00-\x7F]/g, " ")).trim()).toLowerCase().replace(/\s/g, "").replace(/1/g, "i").replace(/0/g, "o").replace(/5/g, "s");
                    for (var a of n.list)
                        if (-1 != o.indexOf(a)) {
                            s = !0;
                            break
                        }
                    t.length > 0 && !s && (this.name = t),
                        this.skinColor = 0,
                        i.skinColors[e.skin] && (this.skinColor = e.skin)
                }
            },
                this.getData = function() {
                return [this.id, this.sid, this.name, l.fixTo(this.x, 2), l.fixTo(this.y, 2), l.fixTo(this.dir, 3), this.health, this.maxHealth, this.scale, this.skinColor]
            },
                this.setData = function(e) {
                this.id = e[0],
                    this.sid = e[1],
                    this.name = e[2],
                    this.x = e[3],
                    this.y = e[4],
                    this.dir = e[5],
                    this.health = e[6],
                    this.maxHealth = e[7],
                    this.scale = e[8],
                    this.skinColor = e[9]
            };
            var b = 0;
            this.update = function(e) {
                if (this.alive) {
                    if(this.health != this.healthMov){
                        this.health < this.healthMov ? (this.healthMov -= 3) : (this.healthMov += 3);
                        if(Math.abs(this.health - this.healthMov) < 3) this.healthMov = this.health;
                    };
                    if (this.shameTimer > 0 && (this.shameTimer -= e,
                                                this.shameTimer <= 0 && (this.shameTimer = 0,
                                                                         this.shameCount = 0)),
                        (b -= e) <= 0) {
                        var t = (this.skin && this.skin.healthRegen ? this.skin.healthRegen : 0) + (this.tail && this.tail.healthRegen ? this.tail.healthRegen : 0);
                        t && this.changeHealth(t, this),
                            this.dmgOverTime.dmg && (this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer),
                                                     this.dmgOverTime.time -= 1,
                                                     this.dmgOverTime.time <= 0 && (this.dmgOverTime.dmg = 0)),
                            this.healCol && this.changeHealth(this.healCol, this),
                            b = 1e3
                    }
                    if (this.alive) {
                        if (this.slowMult < 1 && (this.slowMult += 8e-4 * e,
                                                  this.slowMult > 1 && (this.slowMult = 1)),
                            this.noMovTimer += e,
                            (this.xVel || this.yVel) && (this.noMovTimer = 0),
                            this.lockMove)
                            this.xVel = 0,
                                this.yVel = 0;
                        else {
                            var n = (this.buildIndex >= 0 ? .5 : 1) * (p.weapons[this.weaponIndex].spdMult || 1) * (this.skin && this.skin.spdMult || 1) * (this.tail && this.tail.spdMult || 1) * (this.y <= i.snowBiomeTop ? this.skin && this.skin.coldM ? 1 : i.snowSpeed : 1) * this.slowMult;
                            !this.zIndex && this.y >= i.mapScale / 2 - i.riverWidth / 2 && this.y <= i.mapScale / 2 + i.riverWidth / 2 && (this.skin && this.skin.watrImm ? (n *= .75,
                                    this.xVel += .4 * i.waterCurrent * e) : (n *= .33,
                                                                             this.xVel += i.waterCurrent * e));
                            var s = null != this.moveDir ? o(this.moveDir) : 0,
                                f = null != this.moveDir ? a(this.moveDir) : 0,
                                g = c(s * s + f * f);
                            0 != g && (s /= g,
                                       f /= g),
                                s && (this.xVel += s * this.speed * n * e),
                                f && (this.yVel += f * this.speed * n * e)
                        }
                        var m;
                        this.zIndex = 0,
                            this.lockMove = !1,
                            this.healCol = 0;
                        for (var y = l.getDistance(0, 0, this.xVel * e, this.yVel * e), k = Math.min(4, Math.max(1, Math.round(y / 40))), w = 1 / k, v = {}, x = 0; x < k; ++x) {
                            this.xVel && (this.x += this.xVel * e * w),
                                this.yVel && (this.y += this.yVel * e * w),
                                m = u.getGridArrays(this.x, this.y, this.scale);
                            for (var S = 0; S < m.length; ++S) {
                                for (var I = 0; I < m[S].length && (!m[S][I].active || v[m[S][I].sid] || !u.checkCollision(this, m[S][I], w) || (v[m[S][I].sid] = !0,
                                                                                                                                                 this.alive)); ++I)
                                    ;
                                if (!this.alive)
                                    break
                            }
                            if (!this.alive)
                                break
                        }
                        for (x = (M = d.indexOf(this)) + 1; x < d.length; ++x)
                            d[x] != this && d[x].alive && u.checkCollision(this, d[x]);
                        if (this.xVel && (this.xVel *= r(i.playerDecel, e),
                                          this.xVel <= .01 && this.xVel >= -.01 && (this.xVel = 0)),
                            this.yVel && (this.yVel *= r(i.playerDecel, e),
                                          this.yVel <= .01 && this.yVel >= -.01 && (this.yVel = 0)),
                            this.x - this.scale < 0 ? this.x = this.scale : this.x + this.scale > i.mapScale && (this.x = i.mapScale - this.scale),
                            this.y - this.scale < 0 ? this.y = this.scale : this.y + this.scale > i.mapScale && (this.y = i.mapScale - this.scale),
                            this.buildIndex < 0)
                            if (this.reloads[this.weaponIndex] > 0)
                                this.reloads[this.weaponIndex] -= e,
                                    this.gathering = this.mouseState;
                            else if (this.gathering || this.autoGather) {
                                var T = !0;
                                if (null != p.weapons[this.weaponIndex].gather)
                                    this.gather(d);
                                else if (null != p.weapons[this.weaponIndex].projectile && this.hasRes(p.weapons[this.weaponIndex], this.skin ? this.skin.projCost : 0)) {
                                    this.useRes(p.weapons[this.weaponIndex], this.skin ? this.skin.projCost : 0),
                                        this.noMovTimer = 0;
                                    var M = p.weapons[this.weaponIndex].projectile,
                                        C = 2 * this.scale,
                                        P = this.skin && this.skin.aMlt ? this.skin.aMlt : 1;
                                    p.weapons[this.weaponIndex].rec && (this.xVel -= p.weapons[this.weaponIndex].rec * o(this.dir),
                                                                        this.yVel -= p.weapons[this.weaponIndex].rec * a(this.dir)),
                                        h.addProjectile(this.x + C * o(this.dir), this.y + C * a(this.dir), this.dir, p.projectiles[M].range * P, p.projectiles[M].speed * P, M, this, null, this.zIndex)
                                } else
                                    T = !1;
                                this.gathering = this.mouseState,
                                    T && (this.reloads[this.weaponIndex] = p.weapons[this.weaponIndex].speed * (this.skin && this.skin.atkSpd || 1))
                            }
                    }
                }
            },
                this.addWeaponXP = function(e) {
                this.weaponXP[this.weaponIndex] || (this.weaponXP[this.weaponIndex] = 0),
                    this.weaponXP[this.weaponIndex] += e
            },
                this.earnXP = function(e) {
                this.age < i.maxAge && (this.XP += e,
                                        this.XP >= this.maxXP ? (this.age < i.maxAge ? (this.age++,
                                                                                        this.XP = 0,
                                                                                        this.maxXP *= 1.2) : this.XP = this.maxXP,
                                                                 this.upgradePoints++,
                                                                 y.send(this.id, "16", this.upgradePoints, this.upgrAge),
                                                                 y.send(this.id, "15", this.XP, l.fixTo(this.maxXP, 1), this.age)) : y.send(this.id, "15", this.XP))
            },
                this.changeHealth = function(e, t) {
                if (e > 0 && this.health >= this.maxHealth)
                    return !1;
                e < 0 && this.skin && (e *= this.skin.dmgMult || 1),
                    e < 0 && this.tail && (e *= this.tail.dmgMult || 1),
                    e < 0 && (this.hitTime = Date.now()),
                    this.health += e,
                    this.health > this.maxHealth && (e -= this.health - this.maxHealth,
                                                     this.health = this.maxHealth),
                    this.health <= 0 && this.kill(t);
                for (var i = 0; i < d.length; ++i)
                    this.sentTo[d[i].id] && y.send(d[i].id, "h", this.sid, this.health);
                return !t || !t.canSee(this) || t == this && e < 0 || y.send(t.id, "t", Math.round(this.x), Math.round(this.y), Math.round(-e), 1),
                    !0
            },
                this.kill = function(e) {
                e && e.alive && (e.kills++,
                                 e.skin && e.skin.goldSteal ? k(e, Math.round(this.points / 2)) : k(e, Math.round(100 * this.age * (e.skin && e.skin.kScrM ? e.skin.kScrM : 1))),
                                 y.send(e.id, "9", "kills", e.kills, 1)),
                    this.alive = !1,
                    y.send(this.id, "11"),
                    w()
            },
                this.addResource = function(e, t, n) {
                !n && t > 0 && this.addWeaponXP(t),
                    3 == e ? k(this, t, !0) : (this[i.resourceTypes[e]] += t,
                                               y.send(this.id, "9", i.resourceTypes[e], this[i.resourceTypes[e]], 1))
            },
                this.changeItemCount = function(e, t) {
                this.itemCounts[e] = this.itemCounts[e] || 0,
                    this.itemCounts[e] += t,
                    y.send(this.id, "14", e, this.itemCounts[e])
            },
                this.buildItemPos = function(e, r) {
                [null, undefined].includes(r) && (r = this.d2);
                var t = (this.scale + e.scale + (e.placeOffset || 0));
                var n = this.x2 + (t * Math.cos(r));
                var i = this.y2 + (t * Math.sin(r));
                return {
                    x: n,
                    y: i
                };
            },
                this.buildItem = function(e, r) {
                [null, undefined].includes(r) && (r = this.d2);
                var t = (this.scale + e.scale + (e.placeOffset || 0));
                var n = this.x2 + (t * Math.cos(r));
                var i = this.y2 + (t * Math.sin(r));
                return this.canBuild(e) && (e.consume || u.checkItemLocation(n, i, e.scale, 0.6, e.id, false, this));
            },
                this.hasRes = function(e, t) {
                if (i.inSandbox) return true;
                for (var v = 0; v < e.req.length;) {
                    if (this[e.req[v]] < Math.round(e.req[v + 1] * (t || 1))) return false;
                    v += 2;
                }
                return true;
            },
                this.useRes = function(e, t) {
                if (!i.inSandbox)
                    for (var n = 0; n < e.req.length;)
                        this.addResource(i.resourceTypes.indexOf(e.req[n]), -Math.round(e.req[n + 1] * (t || 1))),
                            n += 2
            },
                this.canBuild = function(e) {
                if (e.group.limit && this.itemCounts[e.group.id] >= (i.inSandbox ? 299 : e.group.limit)) return false;
                return this.hasRes(e);
            },
                this.gather = function() {
                this.noMovTimer = 0,
                    this.slowMult -= p.weapons[this.weaponIndex].hitSlow || .3,
                    this.slowMult < 0 && (this.slowMult = 0);
                for (var e, t, n, s = i.fetchVariant(this), r = s.poison, c = s.val, h = {}, g = u.getGridArrays(this.x, this.y, p.weapons[this.weaponIndex].range), m = 0; m < g.length; ++m)
                    for (var y = 0; y < g[m].length; ++y)
                        if ((t = g[m][y]).active && !t.dontGather && !h[t.sid] && t.visibleToPlayer(this) && l.getDistance(this.x, this.y, t.x, t.y) - t.scale <= p.weapons[this.weaponIndex].range && (e = l.getDirection(t.x, t.y, this.x, this.y),
                                    l.getAngleDist(e, this.dir) <= i.gatherAngle)) {
                            if (h[t.sid] = 1,
                                t.health) {
                                if (t.changeHealth(-p.weapons[this.weaponIndex].dmg * c * (p.weapons[this.weaponIndex].sDmg || 1) * (this.skin && this.skin.bDmg ? this.skin.bDmg : 1), this)) {
                                    for (var k = 0; k < t.req.length;)
                                        this.addResource(i.resourceTypes.indexOf(t.req[k]), t.req[k + 1]),
                                            k += 2;
                                    u.disableObj(t)
                                }
                            } else {
                                this.earnXP(4 * p.weapons[this.weaponIndex].gather);
                                var w = p.weapons[this.weaponIndex].gather + (3 == t.type ? 4 : 0);
                                this.skin && this.skin.extraGold && this.addResource(3, 1),
                                    this.addResource(t.type, w)
                            }
                            n = !0,
                                u.hitObj(t, e)
                        }
                for (y = 0; y < d.length + f.length; ++y)
                    if ((t = d[y] || f[y - d.length]) != this && t.alive && (!t.team || t.team != this.team) && l.getDistance(this.x, this.y, t.x, t.y) - 1.8 * t.scale <= p.weapons[this.weaponIndex].range && (e = l.getDirection(t.x, t.y, this.x, this.y),
                                l.getAngleDist(e, this.dir) <= i.gatherAngle)) {
                        var v = p.weapons[this.weaponIndex].steal;
                        v && t.addResource && (v = Math.min(t.points || 0, v),
                                               this.addResource(3, v),
                                               t.addResource(3, -v));
                        var b = c;
                        null != t.weaponIndex && p.weapons[t.weaponIndex].shield && l.getAngleDist(e + Math.PI, t.dir) <= i.shieldAngle && (b = p.weapons[t.weaponIndex].shield);
                        var x = p.weapons[this.weaponIndex].dmg,
                            S = x * (this.skin && this.skin.dmgMultO ? this.skin.dmgMultO : 1) * (this.tail && this.tail.dmgMultO ? this.tail.dmgMultO : 1),
                            I = .3 * (t.weightM || 1) + (p.weapons[this.weaponIndex].knock || 0);
                        t.xVel += I * o(e),
                            t.yVel += I * a(e),
                            this.skin && this.skin.healD && this.changeHealth(S * b * this.skin.healD, this),
                            this.tail && this.tail.healD && this.changeHealth(S * b * this.tail.healD, this),
                            t.skin && t.skin.dmg && this.changeHealth(-x * t.skin.dmg, t),
                            t.tail && t.tail.dmg && this.changeHealth(-x * t.tail.dmg, t),
                            !(t.dmgOverTime && this.skin && this.skin.poisonDmg) || t.skin && t.skin.poisonRes || (t.dmgOverTime.dmg = this.skin.poisonDmg,
                                                                                                                   t.dmgOverTime.time = this.skin.poisonTime || 1,
                                                                                                                   t.dmgOverTime.doer = this),
                            !t.dmgOverTime || !r || t.skin && t.skin.poisonRes || (t.dmgOverTime.dmg = 5,
                                                                                   t.dmgOverTime.time = 5,
                                                                                   t.dmgOverTime.doer = this),
                            t.skin && t.skin.dmgK && (this.xVel -= t.skin.dmgK * o(e),
                                                      this.yVel -= t.skin.dmgK * a(e)),
                            t.changeHealth(-S * b, this, this)
                    }
                this.sendAnimation(n ? 1 : 0)
            },
                this.sendAnimation = function(e) {
                for (var t = 0; t < d.length; ++t)
                    this.sentTo[d[t].id] && this.canSee(d[t]) && y.send(d[t].id, "7", this.sid, e ? 1 : 0, this.weaponIndex)
            };
            var x = 0,
                S = 0;
            this.animate = function(e) {
                this.animTime > 0 && (this.animTime -= e,
                                      this.animTime <= 0 ? (this.animTime = 0,
                                                            this.dirPlus = 0,
                                                            x = 0,
                                                            S = 0) : 0 == S ? (x += e / (this.animSpeed * i.hitReturnRatio),
                                                                               this.dirPlus = l.lerp(0, this.targetAngle, Math.min(1, x)),
                                                                               x >= 1 && (x = 1,
                                                                                          S = 1)) : (x -= e / (this.animSpeed * (1 - i.hitReturnRatio)),
                                                                                                     this.dirPlus = l.lerp(0, this.targetAngle, Math.max(0, x))))
            },
                this.startAnim = function(e, t) {
                this.animTime = this.animSpeed = p.weapons[t].speed,
                    this.targetAngle = e ? -i.hitAngle : -Math.PI,
                    x = 0,
                    S = 0
            };
            this.canShot = function(other, indx) {
                if (!other) return false;
                if (indx == 1 && !this.skins[53] && this.points <= 1e4) return false;
                let dist = l.getDistance(this.x2, this.y2, other.x2, other.y2);
                let dir = l.getDirection(other.x2, other.y2, this.x2, this.y2);
                let projectile = p.projectiles[indx];
                if (!projectile || projectile.range < dist) return false;
                let tmpList = u.objects.filter(e =>
                                               e.active && l.getDistance(e.x, e.y, this.x2, this.y2) - e.scale <= dist &&
                                               l.getAngleDist(dir, l.getDirection(e.x, e.y, this.x2, this.y2)) <= e.getScale() * Math.PI / 180 &&
                                               (indx == 1 && e.id ? e.group.id == 3 || e.id == 17 : true) &&
                                               !e.ignoreCollision);
                let tmpList2 = d.filter(e =>
                                        e.sid != this.sid &&
                                        e.sid != other.sid &&
                                        l.getAngleDist(dir, l.getDirection(e.x2, e.y2, this.x2, this.y2)) <= e.scale * Math.PI / 180);
                let tmpList3 = f.filter(e =>
                                        l.getAngleDist(dir, l.getDirection(e.x2, e.y2, this.x2, this.y2)) <= e.scale * Math.PI / 180);
                tmpList = [...tmpList, ...tmpList2, ...tmpList3];

                // HIT OBJECTS:
                if (tmpList.length > 0) {
                    for (let tmpObj of tmpList) {
                        let x2 = tmpObj[tmpObj.isObject ? "x" : "x2"],
                            y2 = tmpObj[tmpObj.isObject ? "y" : "y2"];
                        let tmpDist = l.getDistance(this.x2, this.y2, x2, y2);
                        let tmpDir = l.getDirection(x2, y2, this.x2, this.y2);
                        let x = this.x2 + Math.cos(dir) * tmpDist,
                            y = this.y2 + Math.sin(dir) * tmpDist;
                        if (l.lineInRect(x2 - tmpObj.scale,
                                         y2 - tmpObj.scale,
                                         x2 + tmpObj.scale,
                                         y2 + tmpObj.scale,
                                         x, y, x, y)) {
                            return tmpObj;
                        }
                    }
                }
                return true;
            };
            this.canSee = function(e) {
                if (!e)
                    return !1;
                if (e.skin && e.skin.invisTimer && e.noMovTimer >= e.skin.invisTimer)
                    return !1;
                var t = s(e.x - this.x) - e.scale,
                    n = s(e.y - this.y) - e.scale;
                return t <= i.maxScreenWidth / 2 * 1.3 && n <= i.maxScreenHeight / 2 * 1.3
            }
        }
    }, function(e, t, i) {
        const n = i(14).words,
              s = i(15).array;
        e.exports = class {
            constructor(e = {}) {
                Object.assign(this, {
                    list: e.emptyList && [] || Array.prototype.concat.apply(n, [s, e.list || []]),
                    exclude: e.exclude || [],
                    placeHolder: e.placeHolder || "*",
                    regex: e.regex || /[^a-zA-Z0-9|\$|\@]|\^/g,
                    replaceRegex: e.replaceRegex || /\w/g
                })
            }
            isProfane(e) {
                return this.list.filter(t => {
                    const i = new RegExp(`\\b${t.replace(/(\W)/g, "\\$1")}\\b`, "gi");
                    return !this.exclude.includes(t.toLowerCase()) && i.test(e)
                }).length > 0 || !1
            }
            replaceWord(e) {
                return e.replace(this.regex, "").replace(this.replaceRegex, this.placeHolder)
            }
            clean(e) {
                return e.split(/\b/).map(e => this.isProfane(e) ? this.replaceWord(e) : e).join("")
            }
            addWords() {
                let e = Array.from(arguments);
                this.list.push(...e),
                    e.map(e => e.toLowerCase()).forEach(e => {
                    this.exclude.includes(e) && this.exclude.splice(this.exclude.indexOf(e), 1)
                })
            }
            removeWords() {
                this.exclude.push(...Array.from(arguments).map(e => e.toLowerCase()))
            }
        }
    }, function(e) {
        e.exports = {
            words: ["ahole", "anus", "ash0le", "ash0les", "asholes", "ass", "Ass Monkey", "Assface", "assh0le", "assh0lez", "asshole", "assholes", "assholz", "asswipe", "azzhole", "bassterds", "bastard", "bastards", "bastardz", "basterds", "basterdz", "Biatch", "bitch", "bitches", "Blow Job", "boffing", "butthole", "buttwipe", "c0ck", "c0cks", "c0k", "Carpet Muncher", "cawk", "cawks", "Clit", "cnts", "cntz", "cock", "cockhead", "cock-head", "cocks", "CockSucker", "cock-sucker", "crap", "cum", "cunt", "cunts", "cuntz", "dick", "dild0", "dild0s", "dildo", "dildos", "dilld0", "dilld0s", "dominatricks", "dominatrics", "dominatrix", "dyke", "enema", "f u c k", "f u c k e r", "fag", "fag1t", "faget", "fagg1t", "faggit", "faggot", "fagg0t", "fagit", "fags", "fagz", "faig", "faigs", "fart", "flipping the bird", "fuck", "fucker", "fuckin", "fucking", "fucks", "Fudge Packer", "fuk", "Fukah", "Fuken", "fuker", "Fukin", "Fukk", "Fukkah", "Fukken", "Fukker", "Fukkin", "g00k", "God-damned", "h00r", "h0ar", "h0re", "hells", "hoar", "hoor", "hoore", "jackoff", "jap", "japs", "jerk-off", "jisim", "jiss", "jizm", "jizz", "knob", "knobs", "knobz", "kunt", "kunts", "kuntz", "Lezzian", "Lipshits", "Lipshitz", "masochist", "masokist", "massterbait", "masstrbait", "masstrbate", "masterbaiter", "masterbate", "masterbates", "Motha Fucker", "Motha Fuker", "Motha Fukkah", "Motha Fukker", "Mother Fucker", "Mother Fukah", "Mother Fuker", "Mother Fukkah", "Mother Fukker", "mother-fucker", "Mutha Fucker", "Mutha Fukah", "Mutha Fuker", "Mutha Fukkah", "Mutha Fukker", "n1gr", "nastt", "nigger;", "nigur;", "niiger;", "niigr;", "orafis", "orgasim;", "orgasm", "orgasum", "oriface", "orifice", "orifiss", "packi", "packie", "packy", "paki", "pakie", "paky", "pecker", "peeenus", "peeenusss", "peenus", "peinus", "pen1s", "penas", "penis", "penis-breath", "penus", "penuus", "Phuc", "Phuck", "Phuk", "Phuker", "Phukker", "polac", "polack", "polak", "Poonani", "pr1c", "pr1ck", "pr1k", "pusse", "pussee", "pussy", "puuke", "puuker", "queer", "queers", "queerz", "qweers", "qweerz", "qweir", "recktum", "rectum", "retard", "sadist", "scank", "schlong", "screwing", "semen", "sex", "sexy", "Sh!t", "sh1t", "sh1ter", "sh1ts", "sh1tter", "sh1tz", "shit", "shits", "shitter", "Shitty", "Shity", "shitz", "Shyt", "Shyte", "Shytty", "Shyty", "skanck", "skank", "skankee", "skankey", "skanks", "Skanky", "slag", "slut", "sluts", "Slutty", "slutz", "son-of-a-bitch", "tit", "turd", "va1jina", "vag1na", "vagiina", "vagina", "vaj1na", "vajina", "vullva", "vulva", "w0p", "wh00r", "wh0re", "whore", "xrated", "xxx", "b!+ch", "bitch", "blowjob", "clit", "arschloch", "fuck", "shit", "ass", "asshole", "b!tch", "b17ch", "b1tch", "bastard", "bi+ch", "boiolas", "buceta", "c0ck", "cawk", "chink", "cipa", "clits", "cock", "cum", "cunt", "dildo", "dirsa", "ejakulate", "fatass", "fcuk", "fuk", "fux0r", "hoer", "hore", "jism", "kawk", "l3itch", "l3i+ch", "lesbian", "masturbate", "masterbat*", "masterbat3", "motherfucker", "s.o.b.", "mofo", "nazi", "nigga", "nigger", "nutsack", "phuck", "pimpis", "pusse", "pussy", "scrotum", "sh!t", "shemale", "shi+", "sh!+", "slut", "smut", "teets", "tits", "boobs", "b00bs", "teez", "testical", "testicle", "titt", "w00se", "jackoff", "wank", "whoar", "whore", "*damn", "*dyke", "*fuck*", "*shit*", "@$$", "amcik", "andskota", "arse*", "assrammer", "ayir", "bi7ch", "bitch*", "bollock*", "breasts", "butt-pirate", "cabron", "cazzo", "chraa", "chuj", "Cock*", "cunt*", "d4mn", "daygo", "dego", "dick*", "dike*", "dupa", "dziwka", "ejackulate", "Ekrem*", "Ekto", "enculer", "faen", "fag*", "fanculo", "fanny", "feces", "feg", "Felcher", "ficken", "fitt*", "Flikker", "foreskin", "Fotze", "Fu(*", "fuk*", "futkretzn", "gook", "guiena", "h0r", "h4x0r", "hell", "helvete", "hoer*", "honkey", "Huevon", "hui", "injun", "jizz", "kanker*", "kike", "klootzak", "kraut", "knulle", "kuk", "kuksuger", "Kurac", "kurwa", "kusi*", "kyrpa*", "lesbo", "mamhoon", "masturbat*", "merd*", "mibun", "monkleigh", "mouliewop", "muie", "mulkku", "muschi", "nazis", "nepesaurio", "nigger*", "orospu", "paska*", "perse", "picka", "pierdol*", "pillu*", "pimmel", "piss*", "pizda", "poontsee", "poop", "porn", "p0rn", "pr0n", "preteen", "pula", "pule", "puta", "puto", "qahbeh", "queef*", "rautenberg", "schaffer", "scheiss*", "schlampe", "schmuck", "screw", "sh!t*", "sharmuta", "sharmute", "shipal", "shiz", "skribz", "skurwysyn", "sphencter", "spic", "spierdalaj", "splooge", "suka", "b00b*", "testicle*", "titt*", "twat", "vittu", "wank*", "wetback*", "wichser", "wop*", "yed", "zabourah"]
        }
    }, function(e, t, i) {
        e.exports = {
            object: i(16),
            array: i(17),
            regex: i(18)
        }
    }, function(e, t) {
        e.exports = {
            "4r5e": 1,
            "5h1t": 1,
            "5hit": 1,
            a55: 1,
            anal: 1,
            anus: 1,
            ar5e: 1,
            arrse: 1,
            arse: 1,
            ass: 1,
            "ass-fucker": 1,
            asses: 1,
            assfucker: 1,
            assfukka: 1,
            asshole: 1,
            assholes: 1,
            asswhole: 1,
            a_s_s: 1,
            "b!tch": 1,
            b00bs: 1,
            b17ch: 1,
            b1tch: 1,
            ballbag: 1,
            balls: 1,
            ballsack: 1,
            bastard: 1,
            beastial: 1,
            beastiality: 1,
            bellend: 1,
            bestial: 1,
            bestiality: 1,
            "bi+ch": 1,
            biatch: 1,
            bitch: 1,
            bitcher: 1,
            bitchers: 1,
            bitches: 1,
            bitchin: 1,
            bitching: 1,
            bloody: 1,
            "blow job": 1,
            blowjob: 1,
            blowjobs: 1,
            boiolas: 1,
            bollock: 1,
            bollok: 1,
            boner: 1,
            boob: 1,
            boobs: 1,
            booobs: 1,
            boooobs: 1,
            booooobs: 1,
            booooooobs: 1,
            breasts: 1,
            buceta: 1,
            bugger: 1,
            bum: 1,
            "bunny fucker": 1,
            butt: 1,
            butthole: 1,
            buttmuch: 1,
            buttplug: 1,
            c0ck: 1,
            c0cksucker: 1,
            "carpet muncher": 1,
            cawk: 1,
            chink: 1,
            cipa: 1,
            cl1t: 1,
            clit: 1,
            clitoris: 1,
            clits: 1,
            cnut: 1,
            cock: 1,
            "cock-sucker": 1,
            cockface: 1,
            cockhead: 1,
            cockmunch: 1,
            cockmuncher: 1,
            cocks: 1,
            cocksuck: 1,
            cocksucked: 1,
            cocksucker: 1,
            cocksucking: 1,
            cocksucks: 1,
            cocksuka: 1,
            cocksukka: 1,
            cok: 1,
            cokmuncher: 1,
            coksucka: 1,
            coon: 1,
            cox: 1,
            crap: 1,
            cum: 1,
            cummer: 1,
            cumming: 1,
            cums: 1,
            cumshot: 1,
            cunilingus: 1,
            cunillingus: 1,
            cunnilingus: 1,
            cunt: 1,
            cuntlick: 1,
            cuntlicker: 1,
            cuntlicking: 1,
            cunts: 1,
            cyalis: 1,
            cyberfuc: 1,
            cyberfuck: 1,
            cyberfucked: 1,
            cyberfucker: 1,
            cyberfuckers: 1,
            cyberfucking: 1,
            d1ck: 1,
            damn: 1,
            dick: 1,
            dickhead: 1,
            dildo: 1,
            dildos: 1,
            dink: 1,
            dinks: 1,
            dirsa: 1,
            dlck: 1,
            "dog-fucker": 1,
            doggin: 1,
            dogging: 1,
            donkeyribber: 1,
            doosh: 1,
            duche: 1,
            dyke: 1,
            ejaculate: 1,
            ejaculated: 1,
            ejaculates: 1,
            ejaculating: 1,
            ejaculatings: 1,
            ejaculation: 1,
            ejakulate: 1,
            "f u c k": 1,
            "f u c k e r": 1,
            f4nny: 1,
            fag: 1,
            fagging: 1,
            faggitt: 1,
            faggot: 1,
            faggs: 1,
            fagot: 1,
            fagots: 1,
            fags: 1,
            fanny: 1,
            fannyflaps: 1,
            fannyfucker: 1,
            fanyy: 1,
            fatass: 1,
            fcuk: 1,
            fcuker: 1,
            fcuking: 1,
            feck: 1,
            fecker: 1,
            felching: 1,
            fellate: 1,
            fellatio: 1,
            fingerfuck: 1,
            fingerfucked: 1,
            fingerfucker: 1,
            fingerfuckers: 1,
            fingerfucking: 1,
            fingerfucks: 1,
            fistfuck: 1,
            fistfucked: 1,
            fistfucker: 1,
            fistfuckers: 1,
            fistfucking: 1,
            fistfuckings: 1,
            fistfucks: 1,
            flange: 1,
            fook: 1,
            fooker: 1,
            fuck: 1,
            fucka: 1,
            fucked: 1,
            fucker: 1,
            fuckers: 1,
            fuckhead: 1,
            fuckheads: 1,
            fuckin: 1,
            fucking: 1,
            fuckings: 1,
            fuckingshitmotherfucker: 1,
            fuckme: 1,
            fucks: 1,
            fuckwhit: 1,
            fuckwit: 1,
            "fudge packer": 1,
            fudgepacker: 1,
            fuk: 1,
            fuker: 1,
            fukker: 1,
            fukkin: 1,
            fuks: 1,
            fukwhit: 1,
            fukwit: 1,
            fux: 1,
            fux0r: 1,
            f_u_c_k: 1,
            gangbang: 1,
            gangbanged: 1,
            gangbangs: 1,
            gaylord: 1,
            gaysex: 1,
            goatse: 1,
            God: 1,
            "god-dam": 1,
            "god-damned": 1,
            goddamn: 1,
            goddamned: 1,
            hardcoresex: 1,
            hell: 1,
            heshe: 1,
            hoar: 1,
            hoare: 1,
            hoer: 1,
            homo: 1,
            hore: 1,
            horniest: 1,
            horny: 1,
            hotsex: 1,
            "jack-off": 1,
            jackoff: 1,
            jap: 1,
            "jerk-off": 1,
            jism: 1,
            jiz: 1,
            jizm: 1,
            jizz: 1,
            kawk: 1,
            knob: 1,
            knobead: 1,
            knobed: 1,
            knobend: 1,
            knobhead: 1,
            knobjocky: 1,
            knobjokey: 1,
            kock: 1,
            kondum: 1,
            kondums: 1,
            kum: 1,
            kummer: 1,
            kumming: 1,
            kums: 1,
            kunilingus: 1,
            "l3i+ch": 1,
            l3itch: 1,
            labia: 1,
            lust: 1,
            lusting: 1,
            m0f0: 1,
            m0fo: 1,
            m45terbate: 1,
            ma5terb8: 1,
            ma5terbate: 1,
            masochist: 1,
            "master-bate": 1,
            masterb8: 1,
            "masterbat*": 1,
            masterbat3: 1,
            masterbate: 1,
            masterbation: 1,
            masterbations: 1,
            masturbate: 1,
            "mo-fo": 1,
            mof0: 1,
            mofo: 1,
            mothafuck: 1,
            mothafucka: 1,
            mothafuckas: 1,
            mothafuckaz: 1,
            mothafucked: 1,
            mothafucker: 1,
            mothafuckers: 1,
            mothafuckin: 1,
            mothafucking: 1,
            mothafuckings: 1,
            mothafucks: 1,
            "mother fucker": 1,
            motherfuck: 1,
            motherfucked: 1,
            motherfucker: 1,
            motherfuckers: 1,
            motherfuckin: 1,
            motherfucking: 1,
            motherfuckings: 1,
            motherfuckka: 1,
            motherfucks: 1,
            muff: 1,
            mutha: 1,
            muthafecker: 1,
            muthafuckker: 1,
            muther: 1,
            mutherfucker: 1,
            n1gga: 1,
            n1gger: 1,
            nazi: 1,
            nigg3r: 1,
            nigg4h: 1,
            nigga: 1,
            niggah: 1,
            niggas: 1,
            niggaz: 1,
            nigger: 1,
            niggers: 1,
            nob: 1,
            "nob jokey": 1,
            nobhead: 1,
            nobjocky: 1,
            nobjokey: 1,
            numbnuts: 1,
            nutsack: 1,
            orgasim: 1,
            orgasims: 1,
            orgasm: 1,
            orgasms: 1,
            p0rn: 1,
            pawn: 1,
            pecker: 1,
            penis: 1,
            penisfucker: 1,
            phonesex: 1,
            phuck: 1,
            phuk: 1,
            phuked: 1,
            phuking: 1,
            phukked: 1,
            phukking: 1,
            phuks: 1,
            phuq: 1,
            pigfucker: 1,
            pimpis: 1,
            piss: 1,
            pissed: 1,
            pisser: 1,
            pissers: 1,
            pisses: 1,
            pissflaps: 1,
            pissin: 1,
            pissing: 1,
            pissoff: 1,
            poop: 1,
            porn: 1,
            porno: 1,
            pornography: 1,
            pornos: 1,
            prick: 1,
            pricks: 1,
            pron: 1,
            pube: 1,
            pusse: 1,
            pussi: 1,
            pussies: 1,
            pussy: 1,
            pussys: 1,
            rectum: 1,
            retard: 1,
            rimjaw: 1,
            rimming: 1,
            "s hit": 1,
            "s.o.b.": 1,
            sadist: 1,
            schlong: 1,
            screwing: 1,
            scroat: 1,
            scrote: 1,
            scrotum: 1,
            semen: 1,
            sex: 1,
            "sh!+": 1,
            "sh!t": 1,
            sh1t: 1,
            shag: 1,
            shagger: 1,
            shaggin: 1,
            shagging: 1,
            shemale: 1,
            "shi+": 1,
            shit: 1,
            shitdick: 1,
            shite: 1,
            shited: 1,
            shitey: 1,
            shitfuck: 1,
            shitfull: 1,
            shithead: 1,
            shiting: 1,
            shitings: 1,
            shits: 1,
            shitted: 1,
            shitter: 1,
            shitters: 1,
            shitting: 1,
            shittings: 1,
            shitty: 1,
            skank: 1,
            slut: 1,
            sluts: 1,
            smegma: 1,
            smut: 1,
            snatch: 1,
            "son-of-a-bitch": 1,
            spac: 1,
            spunk: 1,
            s_h_i_t: 1,
            t1tt1e5: 1,
            t1tties: 1,
            teets: 1,
            teez: 1,
            testical: 1,
            testicle: 1,
            tit: 1,
            titfuck: 1,
            tits: 1,
            titt: 1,
            tittie5: 1,
            tittiefucker: 1,
            titties: 1,
            tittyfuck: 1,
            tittywank: 1,
            titwank: 1,
            tosser: 1,
            turd: 1,
            tw4t: 1,
            twat: 1,
            twathead: 1,
            twatty: 1,
            twunt: 1,
            twunter: 1,
            v14gra: 1,
            v1gra: 1,
            vagina: 1,
            viagra: 1,
            vulva: 1,
            w00se: 1,
            wang: 1,
            wank: 1,
            wanker: 1,
            wanky: 1,
            whoar: 1,
            whore: 1,
            willies: 1,
            willy: 1,
            xrated: 1,
            xxx: 1
        }
    }, function(e, t) {
        e.exports = ["4r5e", "5h1t", "5hit", "a55", "anal", "anus", "ar5e", "arrse", "arse", "ass", "ass-fucker", "asses", "assfucker", "assfukka", "asshole", "assholes", "asswhole", "a_s_s", "b!tch", "b00bs", "b17ch", "b1tch", "ballbag", "balls", "ballsack", "bastard", "beastial", "beastiality", "bellend", "bestial", "bestiality", "bi+ch", "biatch", "bitch", "bitcher", "bitchers", "bitches", "bitchin", "bitching", "bloody", "blow job", "blowjob", "blowjobs", "boiolas", "bollock", "bollok", "boner", "boob", "boobs", "booobs", "boooobs", "booooobs", "booooooobs", "breasts", "buceta", "bugger", "bum", "bunny fucker", "butt", "butthole", "buttmuch", "buttplug", "c0ck", "c0cksucker", "carpet muncher", "cawk", "chink", "cipa", "cl1t", "clit", "clitoris", "clits", "cnut", "cock", "cock-sucker", "cockface", "cockhead", "cockmunch", "cockmuncher", "cocks", "cocksuck", "cocksucked", "cocksucker", "cocksucking", "cocksucks", "cocksuka", "cocksukka", "cok", "cokmuncher", "coksucka", "coon", "cox", "crap", "cum", "cummer", "cumming", "cums", "cumshot", "cunilingus", "cunillingus", "cunnilingus", "cunt", "cuntlick", "cuntlicker", "cuntlicking", "cunts", "cyalis", "cyberfuc", "cyberfuck", "cyberfucked", "cyberfucker", "cyberfuckers", "cyberfucking", "d1ck", "damn", "dick", "dickhead", "dildo", "dildos", "dink", "dinks", "dirsa", "dlck", "dog-fucker", "doggin", "dogging", "donkeyribber", "doosh", "duche", "dyke", "ejaculate", "ejaculated", "ejaculates", "ejaculating", "ejaculatings", "ejaculation", "ejakulate", "f u c k", "f u c k e r", "f4nny", "fag", "fagging", "faggitt", "faggot", "faggs", "fagot", "fagots", "fags", "fanny", "fannyflaps", "fannyfucker", "fanyy", "fatass", "fcuk", "fcuker", "fcuking", "feck", "fecker", "felching", "fellate", "fellatio", "fingerfuck", "fingerfucked", "fingerfucker", "fingerfuckers", "fingerfucking", "fingerfucks", "fistfuck", "fistfucked", "fistfucker", "fistfuckers", "fistfucking", "fistfuckings", "fistfucks", "flange", "fook", "fooker", "fuck", "fucka", "fucked", "fucker", "fuckers", "fuckhead", "fuckheads", "fuckin", "fucking", "fuckings", "fuckingshitmotherfucker", "fuckme", "fucks", "fuckwhit", "fuckwit", "fudge packer", "fudgepacker", "fuk", "fuker", "fukker", "fukkin", "fuks", "fukwhit", "fukwit", "fux", "fux0r", "f_u_c_k", "gangbang", "gangbanged", "gangbangs", "gaylord", "gaysex", "goatse", "God", "god-dam", "god-damned", "goddamn", "goddamned", "hardcoresex", "hell", "heshe", "hoar", "hoare", "hoer", "homo", "hore", "horniest", "horny", "hotsex", "jack-off", "jackoff", "jap", "jerk-off", "jism", "jiz", "jizm", "jizz", "kawk", "knob", "knobead", "knobed", "knobend", "knobhead", "knobjocky", "knobjokey", "kock", "kondum", "kondums", "kum", "kummer", "kumming", "kums", "kunilingus", "l3i+ch", "l3itch", "labia", "lust", "lusting", "m0f0", "m0fo", "m45terbate", "ma5terb8", "ma5terbate", "masochist", "master-bate", "masterb8", "masterbat*", "masterbat3", "masterbate", "masterbation", "masterbations", "masturbate", "mo-fo", "mof0", "mofo", "mothafuck", "mothafucka", "mothafuckas", "mothafuckaz", "mothafucked", "mothafucker", "mothafuckers", "mothafuckin", "mothafucking", "mothafuckings", "mothafucks", "mother fucker", "motherfuck", "motherfucked", "motherfucker", "motherfuckers", "motherfuckin", "motherfucking", "motherfuckings", "motherfuckka", "motherfucks", "muff", "mutha", "muthafecker", "muthafuckker", "muther", "mutherfucker", "n1gga", "n1gger", "nazi", "nigg3r", "nigg4h", "nigga", "niggah", "niggas", "niggaz", "nigger", "niggers", "nob", "nob jokey", "nobhead", "nobjocky", "nobjokey", "numbnuts", "nutsack", "orgasim", "orgasims", "orgasm", "orgasms", "p0rn", "pawn", "pecker", "penis", "penisfucker", "phonesex", "phuck", "phuk", "phuked", "phuking", "phukked", "phukking", "phuks", "phuq", "pigfucker", "pimpis", "piss", "pissed", "pisser", "pissers", "pisses", "pissflaps", "pissin", "pissing", "pissoff", "poop", "porn", "porno", "pornography", "pornos", "prick", "pricks", "pron", "pube", "pusse", "pussi", "pussies", "pussy", "pussys", "rectum", "retard", "rimjaw", "rimming", "s hit", "s.o.b.", "sadist", "schlong", "screwing", "scroat", "scrote", "scrotum", "semen", "sex", "sh!+", "sh!t", "sh1t", "shag", "shagger", "shaggin", "shagging", "shemale", "shi+", "shit", "shitdick", "shite", "shited", "shitey", "shitfuck", "shitfull", "shithead", "shiting", "shitings", "shits", "shitted", "shitter", "shitters", "shitting", "shittings", "shitty", "skank", "slut", "sluts", "smegma", "smut", "snatch", "son-of-a-bitch", "spac", "spunk", "s_h_i_t", "t1tt1e5", "t1tties", "teets", "teez", "testical", "testicle", "tit", "titfuck", "tits", "titt", "tittie5", "tittiefucker", "titties", "tittyfuck", "tittywank", "titwank", "tosser", "turd", "tw4t", "twat", "twathead", "twatty", "twunt", "twunter", "v14gra", "v1gra", "vagina", "viagra", "vulva", "w00se", "wang", "wank", "wanker", "wanky", "whoar", "whore", "willies", "willy", "xrated", "xxx"]
    }, function(e, t) {
        e.exports = /\b(4r5e|5h1t|5hit|a55|anal|anus|ar5e|arrse|arse|ass|ass-fucker|asses|assfucker|assfukka|asshole|assholes|asswhole|a_s_s|b!tch|b00bs|b17ch|b1tch|ballbag|balls|ballsack|bastard|beastial|beastiality|bellend|bestial|bestiality|bi\+ch|biatch|bitch|bitcher|bitchers|bitches|bitchin|bitching|bloody|blow job|blowjob|blowjobs|boiolas|bollock|bollok|boner|boob|boobs|booobs|boooobs|booooobs|booooooobs|breasts|buceta|bugger|bum|bunny fucker|butt|butthole|buttmuch|buttplug|c0ck|c0cksucker|carpet muncher|cawk|chink|cipa|cl1t|clit|clitoris|clits|cnut|cock|cock-sucker|cockface|cockhead|cockmunch|cockmuncher|cocks|cocksuck|cocksucked|cocksucker|cocksucking|cocksucks|cocksuka|cocksukka|cok|cokmuncher|coksucka|coon|cox|crap|cum|cummer|cumming|cums|cumshot|cunilingus|cunillingus|cunnilingus|cunt|cuntlick|cuntlicker|cuntlicking|cunts|cyalis|cyberfuc|cyberfuck|cyberfucked|cyberfucker|cyberfuckers|cyberfucking|d1ck|damn|dick|dickhead|dildo|dildos|dink|dinks|dirsa|dlck|dog-fucker|doggin|dogging|donkeyribber|doosh|duche|dyke|ejaculate|ejaculated|ejaculates|ejaculating|ejaculatings|ejaculation|ejakulate|f u c k|f u c k e r|f4nny|fag|fagging|faggitt|faggot|faggs|fagot|fagots|fags|fanny|fannyflaps|fannyfucker|fanyy|fatass|fcuk|fcuker|fcuking|feck|fecker|felching|fellate|fellatio|fingerfuck|fingerfucked|fingerfucker|fingerfuckers|fingerfucking|fingerfucks|fistfuck|fistfucked|fistfucker|fistfuckers|fistfucking|fistfuckings|fistfucks|flange|fook|fooker|fuck|fucka|fucked|fucker|fuckers|fuckhead|fuckheads|fuckin|fucking|fuckings|fuckingshitmotherfucker|fuckme|fucks|fuckwhit|fuckwit|fudge packer|fudgepacker|fuk|fuker|fukker|fukkin|fuks|fukwhit|fukwit|fux|fux0r|f_u_c_k|gangbang|gangbanged|gangbangs|gaylord|gaysex|goatse|God|god-dam|god-damned|goddamn|goddamned|hardcoresex|hell|heshe|hoar|hoare|hoer|homo|hore|horniest|horny|hotsex|jack-off|jackoff|jap|jerk-off|jism|jiz|jizm|jizz|kawk|knob|knobead|knobed|knobend|knobhead|knobjocky|knobjokey|kock|kondum|kondums|kum|kummer|kumming|kums|kunilingus|l3i\+ch|l3itch|labia|lust|lusting|m0f0|m0fo|m45terbate|ma5terb8|ma5terbate|masochist|master-bate|masterb8|masterbat*|masterbat3|masterbate|masterbation|masterbations|masturbate|mo-fo|mof0|mofo|mothafuck|mothafucka|mothafuckas|mothafuckaz|mothafucked|mothafucker|mothafuckers|mothafuckin|mothafucking|mothafuckings|mothafucks|mother fucker|motherfuck|motherfucked|motherfucker|motherfuckers|motherfuckin|motherfucking|motherfuckings|motherfuckka|motherfucks|muff|mutha|muthafecker|muthafuckker|muther|mutherfucker|n1gga|n1gger|nazi|nigg3r|nigg4h|nigga|niggah|niggas|niggaz|nigger|niggers|nob|nob jokey|nobhead|nobjocky|nobjokey|numbnuts|nutsack|orgasim|orgasims|orgasm|orgasms|p0rn|pawn|pecker|penis|penisfucker|phonesex|phuck|phuk|phuked|phuking|phukked|phukking|phuks|phuq|pigfucker|pimpis|piss|pissed|pisser|pissers|pisses|pissflaps|pissin|pissing|pissoff|poop|porn|porno|pornography|pornos|prick|pricks|pron|pube|pusse|pussi|pussies|pussy|pussys|rectum|retard|rimjaw|rimming|s hit|s.o.b.|sadist|schlong|screwing|scroat|scrote|scrotum|semen|sex|sh!\+|sh!t|sh1t|shag|shagger|shaggin|shagging|shemale|shi\+|shit|shitdick|shite|shited|shitey|shitfuck|shitfull|shithead|shiting|shitings|shits|shitted|shitter|shitters|shitting|shittings|shitty|skank|slut|sluts|smegma|smut|snatch|son-of-a-bitch|spac|spunk|s_h_i_t|t1tt1e5|t1tties|teets|teez|testical|testicle|tit|titfuck|tits|titt|tittie5|tittiefucker|titties|tittyfuck|tittywank|titwank|tosser|turd|tw4t|twat|twathead|twatty|twunt|twunter|v14gra|v1gra|vagina|viagra|vulva|w00se|wang|wank|wanker|wanky|whoar|whore|willies|willy|xrated|xxx)\b/gi
    }, function(e, t) {
        e.exports.hats = [{
            id: 45,
            name: "Shame!",
            dontSell: !0,
            price: 0,
            scale: 120,
            desc: "hacks are for losers"
        }, {
            id: 51,
            name: "Moo Cap",
            price: 0,
            scale: 120,
            desc: "coolest mooer around"
        }, {
            id: 50,
            name: "Apple Cap",
            price: 0,
            scale: 120,
            desc: "apple farms remembers"
        }, {
            id: 28,
            name: "Moo Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 29,
            name: "Pig Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 30,
            name: "Fluff Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 36,
            name: "Pandou Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 37,
            name: "Bear Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 38,
            name: "Monkey Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 44,
            name: "Polar Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 35,
            name: "Fez Hat",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 42,
            name: "Enigma Hat",
            price: 0,
            scale: 120,
            desc: "join the enigma army"
        }, {
            id: 43,
            name: "Blitz Hat",
            price: 0,
            scale: 120,
            desc: "hey everybody i'm blitz"
        }, {
            id: 49,
            name: "Bob XIII Hat",
            price: 0,
            scale: 120,
            desc: "like and subscribe"
        }, {
            id: 57,
            name: "Pumpkin",
            price: 50,
            scale: 120,
            desc: "Spooooky"
        }, {
            id: 8,
            name: "Bummle Hat",
            price: 100,
            scale: 120,
            desc: "no effect"
        }, {
            id: 2,
            name: "Straw Hat",
            price: 500,
            scale: 120,
            desc: "no effect"
        }, {
            id: 15,
            name: "Winter Cap",
            price: 600,
            scale: 120,
            desc: "allows you to move at normal speed in snow",
            coldM: 1
        }, {
            id: 5,
            name: "Cowboy Hat",
            price: 1e3,
            scale: 120,
            desc: "no effect"
        }, {
            id: 4,
            name: "Ranger Hat",
            price: 2e3,
            scale: 120,
            desc: "no effect"
        }, {
            id: 18,
            name: "Explorer Hat",
            price: 2e3,
            scale: 120,
            desc: "no effect"
        }, {
            id: 31,
            name: "Flipper Hat",
            price: 2500,
            scale: 120,
            desc: "have more control while in water",
            watrImm: !0
        }, {
            id: 1,
            name: "Marksman Cap",
            price: 3e3,
            scale: 120,
            desc: "increases arrow speed and range",
            aMlt: 1.3
        }, {
            id: 10,
            name: "Bush Gear",
            price: 3e3,
            scale: 160,
            desc: "allows you to disguise yourself as a bush"
        }, {
            id: 48,
            name: "Halo",
            price: 3e3,
            scale: 120,
            desc: "no effect"
        }, {
            id: 6,
            name: "Soldier Helmet",
            price: 4e3,
            scale: 120,
            desc: "reduces damage taken but slows movement",
            spdMult: .94,
            dmgMult: .75
        }, {
            id: 23,
            name: "Anti Venom Gear",
            price: 4e3,
            scale: 120,
            desc: "makes you immune to poison",
            poisonRes: 1
        }, {
            id: 13,
            name: "Medic Gear",
            price: 5e3,
            scale: 110,
            desc: "slowly regenerates health over time",
            healthRegen: 3
        }, {
            id: 9,
            name: "Miners Helmet",
            price: 5e3,
            scale: 120,
            desc: "earn 1 extra gold per resource",
            extraGold: 1
        }, {
            id: 32,
            name: "Musketeer Hat",
            price: 5e3,
            scale: 120,
            desc: "reduces cost of projectiles",
            projCost: .5
        }, {
            id: 7,
            name: "Bull Helmet",
            price: 6e3,
            scale: 120,
            desc: "increases damage done but drains health",
            healthRegen: -5,
            dmgMultO: 1.5,
            spdMult: .96
        }, {
            id: 22,
            name: "Emp Helmet",
            price: 6e3,
            scale: 120,
            desc: "turrets won't attack but you move slower",
            antiTurret: 1,
            spdMult: .7
        }, {
            id: 12,
            name: "Booster Hat",
            price: 6e3,
            scale: 120,
            desc: "increases your movement speed",
            spdMult: 1.16
        }, {
            id: 26,
            name: "Barbarian Armor",
            price: 8e3,
            scale: 120,
            desc: "knocks back enemies that attack you",
            dmgK: .6
        }, {
            id: 21,
            name: "Plague Mask",
            price: 1e4,
            scale: 120,
            desc: "melee attacks deal poison damage",
            poisonDmg: 5,
            poisonTime: 6
        }, {
            id: 46,
            name: "Bull Mask",
            price: 1e4,
            scale: 120,
            desc: "bulls won't target you unless you attack them",
            bullRepel: 1
        }, {
            id: 14,
            name: "Windmill Hat",
            topSprite: !0,
            price: 1e4,
            scale: 120,
            desc: "generates points while worn",
            pps: 1.5
        }, {
            id: 11,
            name: "Spike Gear",
            topSprite: !0,
            price: 1e4,
            scale: 120,
            desc: "deal damage to players that damage you",
            dmg: .45
        }, {
            id: 53,
            name: "Turret Gear",
            topSprite: !0,
            price: 1e4,
            scale: 120,
            desc: "you become a walking turret",
            turret: {
                proj: 1,
                range: 700,
                rate: 2500
            },
            spdMult: .7
        }, {
            id: 20,
            name: "Samurai Armor",
            price: 12e3,
            scale: 120,
            desc: "increased attack speed and fire rate",
            atkSpd: .78
        }, {
            id: 58,
            name: "Dark Knight",
            price: 12e3,
            scale: 120,
            desc: "restores health when you deal damage",
            healD: .4
        }, {
            id: 27,
            name: "Scavenger Gear",
            price: 15e3,
            scale: 120,
            desc: "earn double points for each kill",
            kScrM: 2
        }, {
            id: 40,
            name: "Tank Gear",
            price: 15e3,
            scale: 120,
            desc: "increased damage to buildings but slower movement",
            spdMult: .3,
            bDmg: 3.3
        }, {
            id: 52,
            name: "Thief Gear",
            price: 15e3,
            scale: 120,
            desc: "steal half of a players gold when you kill them",
            goldSteal: .5
        }, {
            id: 55,
            name: "Bloodthirster",
            price: 2e4,
            scale: 120,
            desc: "Restore Health when dealing damage. And increased damage",
            healD: .25,
            dmgMultO: 1.2
        }, {
            id: 56,
            name: "Assassin Gear",
            price: 2e4,
            scale: 120,
            desc: "Go invisible when not moving. Can't eat. Increased speed",
            noEat: !0,
            spdMult: 1.1,
            invisTimer: 1e3
        }],
            e.exports.accessories = [{
                id: 12,
                name: "Snowball",
                price: 1e3,
                scale: 105,
                xOff: 18,
                desc: "no effect"
            }, {
                id: 9,
                name: "Tree Cape",
                price: 1e3,
                scale: 90,
                desc: "no effect"
            }, {
                id: 10,
                name: "Stone Cape",
                price: 1e3,
                scale: 90,
                desc: "no effect"
            }, {
                id: 3,
                name: "Cookie Cape",
                price: 1500,
                scale: 90,
                desc: "no effect"
            }, {
                id: 8,
                name: "Cow Cape",
                price: 2e3,
                scale: 90,
                desc: "no effect"
            }, {
                id: 11,
                name: "Monkey Tail",
                price: 2e3,
                scale: 97,
                xOff: 25,
                desc: "Super speed but reduced damage",
                spdMult: 1.35,
                dmgMultO: .2
            }, {
                id: 17,
                name: "Apple Basket",
                price: 3e3,
                scale: 80,
                xOff: 12,
                desc: "slowly regenerates health over time",
                healthRegen: 1
            }, {
                id: 6,
                name: "Winter Cape",
                price: 3e3,
                scale: 90,
                desc: "no effect"
            }, {
                id: 4,
                name: "Skull Cape",
                price: 4e3,
                scale: 90,
                desc: "no effect"
            }, {
                id: 5,
                name: "Dash Cape",
                price: 5e3,
                scale: 90,
                desc: "no effect"
            }, {
                id: 2,
                name: "Dragon Cape",
                price: 6e3,
                scale: 90,
                desc: "no effect"
            }, {
                id: 1,
                name: "Super Cape",
                price: 8e3,
                scale: 90,
                desc: "no effect"
            }, {
                id: 7,
                name: "Troll Cape",
                price: 8e3,
                scale: 90,
                desc: "no effect"
            }, {
                id: 14,
                name: "Thorns",
                price: 1e4,
                scale: 115,
                xOff: 20,
                desc: "no effect"
            }, {
                id: 15,
                name: "Blockades",
                price: 1e4,
                scale: 95,
                xOff: 15,
                desc: "no effect"
            }, {
                id: 20,
                name: "Devils Tail",
                price: 1e4,
                scale: 95,
                xOff: 20,
                desc: "no effect"
            }, {
                id: 16,
                name: "Sawblade",
                price: 12e3,
                scale: 90,
                spin: !0,
                xOff: 0,
                desc: "deal damage to players that damage you",
                dmg: .15
            }, {
                id: 13,
                name: "Angel Wings",
                price: 15e3,
                scale: 138,
                xOff: 22,
                desc: "slowly regenerates health over time",
                healthRegen: 3
            }, {
                id: 19,
                name: "Shadow Wings",
                price: 15e3,
                scale: 138,
                xOff: 22,
                desc: "increased movement speed",
                spdMult: 1.1
            }, {
                id: 18,
                name: "Blood Wings",
                price: 2e4,
                scale: 178,
                xOff: 26,
                desc: "restores health when you deal damage",
                healD: .2
            }, {
                id: 21,
                name: "Corrupt X Wings",
                price: 2e4,
                scale: 178,
                xOff: 26,
                desc: "deal damage to players that damage you",
                dmg: .25
            }]
    }, function(e, t) {
        e.exports = function(e, t, i, n, s, o, a) {
            this.init = function(e, t, i, n, s, o, r, c, l) {
                this.active = !0,
                    this.indx = e,
                    this.x = t,
                    this.y = i,
                    this.dir = n,
                    this.skipMov = !0,
                    this.speed = s,
                    this.dmg = o,
                    this.scale = c,
                    this.range = r,
                    this.owner = l,
                    a && (this.sentTo = {})
            };
            var r, c = [];
            this.update = function(l) {
                if (this.active) {
                    var h, u = this.speed * l;
                    if (this.skipMov ? this.skipMov = !1 : (this.x += u * Math.cos(this.dir),
                                                            this.y += u * Math.sin(this.dir),
                                                            this.range -= u,
                                                            this.range <= 0 && (this.x += this.range * Math.cos(this.dir),
                                                                                this.y += this.range * Math.sin(this.dir),
                                                                                u = 1,
                                                                                this.range = 0,
                                                                                this.active = !1)),
                        a) {
                        for (var d = 0; d < e.length; ++d)
                            !this.sentTo[e[d].id] && e[d].canSee(this) && (this.sentTo[e[d].id] = 1,
                                                                           a.send(e[d].id, "18", o.fixTo(this.x, 1), o.fixTo(this.y, 1), o.fixTo(this.dir, 2), o.fixTo(this.range, 1), this.speed, this.indx, this.layer, this.sid));
                        for (c.length = 0,
                             d = 0; d < e.length + t.length; ++d)
                            !(r = e[d] || t[d - e.length]).alive || r == this.owner || this.owner.team && r.team == this.owner.team || o.lineInRect(r.x - r.scale, r.y - r.scale, r.x + r.scale, r.y + r.scale, this.x, this.y, this.x + u * Math.cos(this.dir), this.y + u * Math.sin(this.dir)) && c.push(r);
                        for (var f = i.getGridArrays(this.x, this.y, this.scale), p = 0; p < f.length; ++p)
                            for (var g = 0; g < f[p].length; ++g)
                                h = (r = f[p][g]).getScale(),
                                    r.active && this.ignoreObj != r.sid && this.layer <= r.layer && c.indexOf(r) < 0 && !r.ignoreCollision && o.lineInRect(r.x - h, r.y - h, r.x + h, r.y + h, this.x, this.y, this.x + u * Math.cos(this.dir), this.y + u * Math.sin(this.dir)) && c.push(r);
                        if (c.length > 0) {
                            var m = null,
                                y = null,
                                k = null;
                            for (d = 0; d < c.length; ++d)
                                k = o.getDistance(this.x, this.y, c[d].x, c[d].y),
                                    (null == y || k < y) && (y = k,
                                                             m = c[d]);
                            if (m.isPlayer || m.isAI) {
                                var w = .3 * (m.weightM || 1);
                                m.xVel += w * Math.cos(this.dir),
                                    m.yVel += w * Math.sin(this.dir),
                                    null != m.weaponIndex && n.weapons[m.weaponIndex].shield && o.getAngleDist(this.dir + Math.PI, m.dir) <= s.shieldAngle || m.changeHealth(-this.dmg, this.owner, this.owner)
                            } else
                                for (m.projDmg && m.health && m.changeHealth(-this.dmg) && i.disableObj(m),
                                     d = 0; d < e.length; ++d)
                                    e[d].active && (m.sentTo[e[d].id] && (m.active ? e[d].canSee(m) && a.send(e[d].id, "8", o.fixTo(this.dir, 2), m.sid) : a.send(e[d].id, "12", m.sid)),
                                                    m.active || m.owner != e[d] || e[d].changeItemCount(m.group.id, -1));
                            for (this.active = !1,
                                 d = 0; d < e.length; ++d)
                                this.sentTo[e[d].id] && a.send(e[d].id, "19", this.sid, o.fixTo(y, 1))
                        }
                    }
                }
            }
        }
    }, function(e, t) {
        e.exports = function(e, t, i, n, s, o, a, r, c) {
            this.addProjectile = function(l, h, u, d, f, p, g, m, y) {
                for (var k, w = o.projectiles[p], v = 0; v < t.length; ++v)
                    if (!t[v].active) {
                        k = t[v];
                        break
                    }
                return k || ((k = new e(i, n, s, o, a, r, c)).sid = t.length,
                             t.push(k)),
                    k.init(p, l, h, u, f, w.dmg, d, w.scale, g),
                    k.ignoreObj = m,
                    k.layer = y || w.layer,
                    k.src = w.src,
                    k
            }
        }
    }, function(e, t) {
        e.exports.obj = function(e, t) {
            var i;
            this.sounds = [],
                this.active = !0,
                this.play = function(t, n, s) {
                n && this.active && ((i = this.sounds[t]) || (i = new Howl({
                    src: ".././sound/" + t + ".mp3"
                }),
                                                              this.sounds[t] = i),
                                     s && i.isPlaying || (i.isPlaying = !0,
                                                          i.play(),
                                                          i.volume((n || 1) * e.volumeMult),
                                                          i.loop(s)))
            },
                this.toggleMute = function(e, t) {
                (i = this.sounds[e]) && i.mute(t)
            },
                this.stop = function(e) {
                (i = this.sounds[e]) && (i.stop(),
                                         i.isPlaying = !1)
            }
        }
    }, function(e, t, i) {
        var n = i(24),
            s = i(32);

        function o(e, t, i, n, s) {
            "localhost" == location.hostname && (window.location.hostname = "127.0.0.1"),
                this.debugLog = !1,
                this.baseUrl = e,
                this.lobbySize = i,
                this.devPort = t,
                this.lobbySpread = n,
                this.rawIPs = !!s,
                this.server = void 0,
                this.gameIndex = void 0,
                this.callback = void 0,
                this.errorCallback = void 0,
                this.processServers(vultr.servers)
        }
        o.prototype.regionInfo = {
            0: {
                name: "Local",
                latitude: 0,
                longitude: 0
            },
            "vultr:1": {
                name: "New Jersey",
                latitude: 40.1393329,
                longitude: -75.8521818
            },
            "vultr:2": {
                name: "Chicago",
                latitude: 41.8339037,
                longitude: -87.872238
            },
            "vultr:3": {
                name: "Dallas",
                latitude: 32.8208751,
                longitude: -96.8714229
            },
            "vultr:4": {
                name: "Seattle",
                latitude: 47.6149942,
                longitude: -122.4759879
            },
            "vultr:5": {
                name: "Los Angeles",
                latitude: 34.0207504,
                longitude: -118.691914
            },
            "vultr:6": {
                name: "Atlanta",
                latitude: 33.7676334,
                longitude: -84.5610332
            },
            "vultr:7": {
                name: "Amsterdam",
                latitude: 52.3745287,
                longitude: 4.7581878
            },
            "vultr:8": {
                name: "London",
                latitude: 51.5283063,
                longitude: -.382486
            },
            "vultr:9": {
                name: "Frankfurt",
                latitude: 50.1211273,
                longitude: 8.496137
            },
            "vultr:12": {
                name: "Silicon Valley",
                latitude: 37.4024714,
                longitude: -122.3219752
            },
            "vultr:19": {
                name: "Sydney",
                latitude: -33.8479715,
                longitude: 150.651084
            },
            "vultr:24": {
                name: "Paris",
                latitude: 48.8588376,
                longitude: 2.2773454
            },
            "vultr:25": {
                name: "Tokyo",
                latitude: 35.6732615,
                longitude: 139.569959
            },
            "vultr:39": {
                name: "Miami",
                latitude: 25.7823071,
                longitude: -80.3012156
            },
            "vultr:40": {
                name: "Singapore",
                latitude: 1.3147268,
                longitude: 103.7065876
            }
        },
            o.prototype.start = function(e, t) {
            this.callback = e,
                this.errorCallback = t;
            var i = this.parseServerQuery();
            i ? (this.log("Found server in query."),
                 this.password = i[3],
                 this.connect(i[0], i[1], i[2])) : (this.log("Pinging servers..."),
                                                    this.pingServers())
        },
            o.prototype.parseServerQuery = function() {
            var e = n.parse(location.href, !0),
                t = e.query.server;
            if ("string" == typeof t) {
                var i = t.split(":");
                if (3 == i.length) {
                    var s = i[0],
                        o = parseInt(i[1]),
                        a = parseInt(i[2]);
                    return "0" == s || s.startsWith("vultr:") || (s = "vultr:" + s),
                        [s, o, a, e.query.password]
                }
                this.errorCallback("Invalid number of server parameters in " + t)
            }
        },
            o.prototype.findServer = function(e, t) {
            var i = this.servers[e];
            if (Array.isArray(i)) {
                for (var n = 0; n < i.length; n++) {
                    var s = i[n];
                    if (s.index == t)
                        return s
                }
                console.warn("Could not find server in region " + e + " with index " + t + ".")
            } else
                this.errorCallback("No server list for region " + e)
        },
            o.prototype.pingServers = function() {
            var e = this,
                t = [];
            for (var i in this.servers)
                if (this.servers.hasOwnProperty(i)) {
                    var n = this.servers[i],
                        s = n[Math.floor(Math.random() * n.length)];
                    null != s ? function(n, s) {
                        var o = new XMLHttpRequest;
                        o.onreadystatechange = function(n) {
                            var o = n.target;
                            if (4 == o.readyState)
                                if (200 == o.status) {
                                    for (var a = 0; a < t.length; a++)
                                        t[a].abort();
                                    e.log("Connecting to region", s.region);
                                    var r = e.seekServer(s.region);
                                    e.connect(r[0], r[1], r[2])
                                } else
                                    console.warn("Error pinging " + s.ip + " in region " + i)
                        };
                        var a = "//" + e.serverAddress(s.ip, !0) + ":" + e.serverPort(s) + "/ping";
                        o.open("GET", a, !0),
                            o.send(null),
                            e.log("Pinging", a),
                            t.push(o)
                    }(0, s) : console.log("No target server for region " + i)
                }
        },
            o.prototype.seekServer = function(e, t, i) {
            null == i && (i = "random"),
                null == t && (t = !1);
            const n = ["random"];
            var s = this.lobbySize,
                o = this.lobbySpread,
                a = this.servers[e].flatMap((function(e) {
                    var t = 0;
                    return e.games.map((function(i) {
                        var n = t++;
                        return {
                            region: e.region,
                            index: e.index * e.games.length + n,
                            gameIndex: n,
                            gameCount: e.games.length,
                            playerCount: i.playerCount,
                            isPrivate: i.isPrivate
                        }
                    }))
                })).filter((function(e) {
                    return !e.isPrivate
                })).filter((function(e) {
                    return !t || 0 == e.playerCount && e.gameIndex >= e.gameCount / 2
                })).filter((function(e) {
                    return "random" == i || n[e.index % n.length].key == i
                })).sort((function(e, t) {
                    return t.playerCount - e.playerCount
                })).filter((function(e) {
                    return e.playerCount < s
                }));
            if (t && a.reverse(),
                0 != a.length) {
                var r = Math.min(o, a.length),
                    c = Math.floor(Math.random() * r),
                    l = a[c = Math.min(c, a.length - 1)],
                    h = l.region,
                    u = (c = Math.floor(l.index / l.gameCount),
                         l.index % l.gameCount);
                return this.log("Found server."),
                    [h, c, u]
            }
            this.errorCallback("No open servers.")
        },
            o.prototype.connect = function(e, t, i) {
            if (!this.connected) {
                var n = this.findServer(e, t);
                null != n ? (this.log("Connecting to server", n, "with game index", i),
                             n.games[i].playerCount >= this.lobbySize ? this.errorCallback("Server is already full.") : (window.history.replaceState(document.title, document.title, this.generateHref(e, t, i, this.password)),
                                                                                                                         this.server = n,
                                                                                                                         this.gameIndex = i,
                                                                                                                         this.log("Calling callback with address", this.serverAddress(n.ip), "on port", this.serverPort(n), "with game index", i),
                                                                                                                         this.callback(this.serverAddress(n.ip), this.serverPort(n), i))) : this.errorCallback("Failed to find server for region " + e + " and index " + t)
            }
        },
            o.prototype.switchServer = function(e, t, i, n) {
            this.switchingServers = !0,
                window.location.href = this.generateHref(e, t, i, n)
        },
            o.prototype.generateHref = function(e, t, i, n) {
            var s = "/?server=" + (e = this.stripRegion(e)) + ":" + t + ":" + i;
            return n && (s += "&password=" + encodeURIComponent(n)),
                s
        },
            o.prototype.serverAddress = function(e, t) {
            return "127.0.0.1" == e || "7f000001" == e || "903d62ef5d1c2fecdcaeb5e7dd485eff" == e ? window.location.hostname : this.rawIPs ? t ? "ip_" + this.hashIP(e) + "." + this.baseUrl : e : "ip_" + e + "." + this.baseUrl
        },
            o.prototype.serverPort = function(e) {
            return 0 == e.region ? this.devPort : location.protocol.startsWith("https") ? 443 : 80
        },
            o.prototype.processServers = function(e) {
            for (var t = {}, i = 0; i < e.length; i++) {
                var n = e[i],
                    s = t[n.region];
                null == s && (s = [],
                              t[n.region] = s),
                    s.push(n)
            }
            for (var o in t)
                t[o] = t[o].sort((function(e, t) {
                    return e.index - t.index
                }));
            this.servers = t
        },
            o.prototype.ipToHex = function(e) {
            return e.split(".").map(e => ("00" + parseInt(e).toString(16)).substr(-2)).join("").toLowerCase()
        },
            o.prototype.hashIP = function(e) {
            return s(this.ipToHex(e))
        },
            o.prototype.log = function() {
            return this.debugLog ? console.log.apply(void 0, arguments) : console.verbose ? console.verbose.apply(void 0, arguments) : void 0
        },
            o.prototype.stripRegion = function(e) {
            return e.startsWith("vultr:") ? e = e.slice(6) : e.startsWith("do:") && (e = e.slice(3)),
                e
        },
            window.testVultrClient = function() {
            var e = 1;

            function t(t, i) {
                (t = "" + t) == (i = "" + i) ? console.log(`Assert ${e} passed.`): console.warn(`Assert ${e} failed. Expected ${i}, got ${t}.`),
                    e++
            }
            var i = new o("test.io", -1, 5, 1, !1);
            i.errorCallback = function(e) {},
                i.processServers(function(e) {
                var t = [];
                for (var i in e)
                    for (var n = e[i], s = 0; s < n.length; s++)
                        t.push({
                            ip: i + ":" + s,
                            scheme: "testing",
                            region: i,
                            index: s,
                            games: n[s].map(e => ({
                                playerCount: e,
                                isPrivate: !1
                            }))
                        });
                return t
            }({
                1: [
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ],
                2: [
                    [5, 1, 0, 0],
                    [0, 0, 0, 0]
                ],
                3: [
                    [5, 0, 1, 5],
                    [0, 0, 0, 0]
                ],
                4: [
                    [5, 1, 1, 5],
                    [1, 0, 0, 0]
                ],
                5: [
                    [5, 1, 1, 5],
                    [1, 0, 4, 0]
                ],
                6: [
                    [5, 5, 5, 5],
                    [2, 3, 1, 4]
                ],
                7: [
                    [5, 5, 5, 5],
                    [5, 5, 5, 5]
                ]
            })),
                t(i.seekServer(1, !1), [1, 0, 0]),
                t(i.seekServer(1, !0), [1, 1, 3]),
                t(i.seekServer(2, !1), [2, 0, 1]),
                t(i.seekServer(2, !0), [2, 1, 3]),
                t(i.seekServer(3, !1), [3, 0, 2]),
                t(i.seekServer(3, !0), [3, 1, 3]),
                t(i.seekServer(4, !1), [4, 0, 1]),
                t(i.seekServer(4, !0), [4, 1, 3]),
                t(i.seekServer(5, !1), [5, 1, 2]),
                t(i.seekServer(5, !0), [5, 1, 3]),
                t(i.seekServer(6, !1), [6, 1, 3]),
                t(i.seekServer(6, !0), void 0),
                t(i.seekServer(7, !1), void 0),
                t(i.seekServer(7, !0), void 0),
                console.log("Tests passed.")
        };
        var a = function(e, t) {
            return e.concat(t)
        };
        Array.prototype.flatMap = function(e) {
            return function(e, t) {
                return t.map(e).reduce(a, [])
            }(e, this)
        },
            e.exports = o
    }, function(e, t, i) {
        "use strict";
        var n = i(25),
            s = i(28);

        function o() {
            this.protocol = null,
                this.slashes = null,
                this.auth = null,
                this.host = null,
                this.port = null,
                this.hostname = null,
                this.hash = null,
                this.search = null,
                this.query = null,
                this.pathname = null,
                this.path = null,
                this.href = null
        }
        t.parse = w,
            t.resolve = function(e, t) {
            return w(e, !1, !0).resolve(t)
        },
            t.resolveObject = function(e, t) {
            return e ? w(e, !1, !0).resolveObject(t) : t
        },
            t.format = function(e) {
            return s.isString(e) && (e = w(e)),
                e instanceof o ? e.format() : o.prototype.format.call(e)
        },
            t.Url = o;
        var a = /^([a-z0-9.+-]+:)/i,
            r = /:[0-9]*$/,
            c = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,
            l = ["{", "}", "|", "\\", "^", "`"].concat(["<", ">", '"', "`", " ", "\r", "\n", "\t"]),
            h = ["'"].concat(l),
            u = ["%", "/", "?", ";", "#"].concat(h),
            d = ["/", "?", "#"],
            f = /^[+a-z0-9A-Z_-]{0,63}$/,
            p = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
            g = {
                javascript: !0,
                "javascript:": !0
            },
            m = {
                javascript: !0,
                "javascript:": !0
            },
            y = {
                http: !0,
                https: !0,
                ftp: !0,
                gopher: !0,
                file: !0,
                "http:": !0,
                "https:": !0,
                "ftp:": !0,
                "gopher:": !0,
                "file:": !0
            },
            k = i(29);

        function w(e, t, i) {
            if (e && s.isObject(e) && e instanceof o)
                return e;
            var n = new o;
            return n.parse(e, t, i),
                n
        }
        o.prototype.parse = function(e, t, i) {
            if (!s.isString(e))
                throw new TypeError("Parameter 'url' must be a string, not " + typeof e);
            var o = e.indexOf("?"),
                r = -1 !== o && o < e.indexOf("#") ? "?" : "#",
                l = e.split(r);
            l[0] = l[0].replace(/\\/g, "/");
            var w = e = l.join(r);
            if (w = w.trim(),
                !i && 1 === e.split("#").length) {
                var v = c.exec(w);
                if (v)
                    return this.path = w,
                        this.href = w,
                        this.pathname = v[1],
                        v[2] ? (this.search = v[2],
                                this.query = t ? k.parse(this.search.substr(1)) : this.search.substr(1)) : t && (this.search = "",
                                                                                                                 this.query = {}),
                        this
            }
            var b = a.exec(w);
            if (b) {
                var x = (b = b[0]).toLowerCase();
                this.protocol = x,
                    w = w.substr(b.length)
            }
            if (i || b || w.match(/^\/\/[^@\/]+@[^@\/]+/)) {
                var S = "//" === w.substr(0, 2);
                !S || b && m[b] || (w = w.substr(2),
                                    this.slashes = !0)
            }
            if (!m[b] && (S || b && !y[b])) {
                for (var I, T, M = -1, C = 0; C < d.length; C++)
                    -
                        1 !== (P = w.indexOf(d[C])) && (-1 === M || P < M) && (M = P);
                for (-1 !== (T = -1 === M ? w.lastIndexOf("@") : w.lastIndexOf("@", M)) && (I = w.slice(0, T),
                                                                                            w = w.slice(T + 1),
                                                                                            this.auth = decodeURIComponent(I)),
                     M = -1,
                     C = 0; C < u.length; C++) {
                    var P; -
                        1 !== (P = w.indexOf(u[C])) && (-1 === M || P < M) && (M = P)
                } -
                    1 === M && (M = w.length),
                    this.host = w.slice(0, M),
                    w = w.slice(M),
                    this.parseHost(),
                    this.hostname = this.hostname || "";
                var E = "[" === this.hostname[0] && "]" === this.hostname[this.hostname.length - 1];
                if (!E)
                    for (var O = this.hostname.split(/\./), B = (C = 0,
                                                                 O.length); C < B; C++) {
                        var j = O[C];
                        if (j && !j.match(f)) {
                            for (var A = "", D = 0, U = j.length; D < U; D++)
                                j.charCodeAt(D) > 127 ? A += "x" : A += j[D];
                            if (!A.match(f)) {
                                var R = O.slice(0, C),
                                    L = O.slice(C + 1),
                                    z = j.match(p);
                                z && (R.push(z[1]),
                                      L.unshift(z[2])),
                                    L.length && (w = "/" + L.join(".") + w),
                                    this.hostname = R.join(".");
                                break
                            }
                        }
                    }
                this.hostname.length > 255 ? this.hostname = "" : this.hostname = this.hostname.toLowerCase(),
                    E || (this.hostname = n.toASCII(this.hostname));
                var _ = this.port ? ":" + this.port : "",
                    F = this.hostname || "";
                this.host = F + _,
                    this.href += this.host,
                    E && (this.hostname = this.hostname.substr(1, this.hostname.length - 2),
                          "/" !== w[0] && (w = "/" + w))
            }
            if (!g[x])
                for (C = 0,
                     B = h.length; C < B; C++) {
                    var H = h[C];
                    if (-1 !== w.indexOf(H)) {
                        var V = encodeURIComponent(H);
                        V === H && (V = escape(H)),
                            w = w.split(H).join(V)
                    }
                }
            var q = w.indexOf("#"); -
                1 !== q && (this.hash = w.substr(q),
                            w = w.slice(0, q));
            var W = w.indexOf("?");
            if (-1 !== W ? (this.search = w.substr(W),
                            this.query = w.substr(W + 1),
                            t && (this.query = k.parse(this.query)),
                            w = w.slice(0, W)) : t && (this.search = "",
                                                       this.query = {}),
                w && (this.pathname = w),
                y[x] && this.hostname && !this.pathname && (this.pathname = "/"),
                this.pathname || this.search) {
                _ = this.pathname || "";
                var X = this.search || "";
                this.path = _ + X
            }
            return this.href = this.format(),
                this
        },
            o.prototype.format = function() {
            var e = this.auth || "";
            e && (e = (e = encodeURIComponent(e)).replace(/%3A/i, ":"),
                  e += "@");
            var t = this.protocol || "",
                i = this.pathname || "",
                n = this.hash || "",
                o = !1,
                a = "";
            this.host ? o = e + this.host : this.hostname && (o = e + (-1 === this.hostname.indexOf(":") ? this.hostname : "[" + this.hostname + "]"),
                                                              this.port && (o += ":" + this.port)),
                this.query && s.isObject(this.query) && Object.keys(this.query).length && (a = k.stringify(this.query));
            var r = this.search || a && "?" + a || "";
            return t && ":" !== t.substr(-1) && (t += ":"),
                this.slashes || (!t || y[t]) && !1 !== o ? (o = "//" + (o || ""),
                                                            i && "/" !== i.charAt(0) && (i = "/" + i)) : o || (o = ""),
                n && "#" !== n.charAt(0) && (n = "#" + n),
                r && "?" !== r.charAt(0) && (r = "?" + r),
                t + o + (i = i.replace(/[?#]/g, (function(e) {
                return encodeURIComponent(e)
            }))) + (r = r.replace("#", "%23")) + n
        },
            o.prototype.resolve = function(e) {
            return this.resolveObject(w(e, !1, !0)).format()
        },
            o.prototype.resolveObject = function(e) {
            if (s.isString(e)) {
                var t = new o;
                t.parse(e, !1, !0),
                    e = t
            }
            for (var i = new o, n = Object.keys(this), a = 0; a < n.length; a++) {
                var r = n[a];
                i[r] = this[r]
            }
            if (i.hash = e.hash,
                "" === e.href)
                return i.href = i.format(),
                    i;
            if (e.slashes && !e.protocol) {
                for (var c = Object.keys(e), l = 0; l < c.length; l++) {
                    var h = c[l];
                    "protocol" !== h && (i[h] = e[h])
                }
                return y[i.protocol] && i.hostname && !i.pathname && (i.path = i.pathname = "/"),
                    i.href = i.format(),
                    i
            }
            if (e.protocol && e.protocol !== i.protocol) {
                if (!y[e.protocol]) {
                    for (var u = Object.keys(e), d = 0; d < u.length; d++) {
                        var f = u[d];
                        i[f] = e[f]
                    }
                    return i.href = i.format(),
                        i
                }
                if (i.protocol = e.protocol,
                    e.host || m[e.protocol])
                    i.pathname = e.pathname;
                else {
                    for (var p = (e.pathname || "").split("/"); p.length && !(e.host = p.shift());)
                        ;
                    e.host || (e.host = ""),
                        e.hostname || (e.hostname = ""),
                        "" !== p[0] && p.unshift(""),
                        p.length < 2 && p.unshift(""),
                        i.pathname = p.join("/")
                }
                if (i.search = e.search,
                    i.query = e.query,
                    i.host = e.host || "",
                    i.auth = e.auth,
                    i.hostname = e.hostname || e.host,
                    i.port = e.port,
                    i.pathname || i.search) {
                    var g = i.pathname || "",
                        k = i.search || "";
                    i.path = g + k
                }
                return i.slashes = i.slashes || e.slashes,
                    i.href = i.format(),
                    i
            }
            var w = i.pathname && "/" === i.pathname.charAt(0),
                v = e.host || e.pathname && "/" === e.pathname.charAt(0),
                b = v || w || i.host && e.pathname,
                x = b,
                S = i.pathname && i.pathname.split("/") || [],
                I = (p = e.pathname && e.pathname.split("/") || [],
                     i.protocol && !y[i.protocol]);
            if (I && (i.hostname = "",
                      i.port = null,
                      i.host && ("" === S[0] ? S[0] = i.host : S.unshift(i.host)),
                      i.host = "",
                      e.protocol && (e.hostname = null,
                                     e.port = null,
                                     e.host && ("" === p[0] ? p[0] = e.host : p.unshift(e.host)),
                                     e.host = null),
                      b = b && ("" === p[0] || "" === S[0])),
                v)
                i.host = e.host || "" === e.host ? e.host : i.host,
                    i.hostname = e.hostname || "" === e.hostname ? e.hostname : i.hostname,
                    i.search = e.search,
                    i.query = e.query,
                    S = p;
            else if (p.length)
                S || (S = []),
                    S.pop(),
                    S = S.concat(p),
                    i.search = e.search,
                    i.query = e.query;
            else if (!s.isNullOrUndefined(e.search))
                return I && (i.hostname = i.host = S.shift(),
                             (E = !!(i.host && i.host.indexOf("@") > 0) && i.host.split("@")) && (i.auth = E.shift(),
                                                                                                  i.host = i.hostname = E.shift())),
                    i.search = e.search,
                    i.query = e.query,
                    s.isNull(i.pathname) && s.isNull(i.search) || (i.path = (i.pathname ? i.pathname : "") + (i.search ? i.search : "")),
                    i.href = i.format(),
                    i;
            if (!S.length)
                return i.pathname = null,
                    i.search ? i.path = "/" + i.search : i.path = null,
                    i.href = i.format(),
                    i;
            for (var T = S.slice(-1)[0], M = (i.host || e.host || S.length > 1) && ("." === T || ".." === T) || "" === T, C = 0, P = S.length; P >= 0; P--)
                "." === (T = S[P]) ? S.splice(P, 1) : ".." === T ? (S.splice(P, 1),
                                                                    C++) : C && (S.splice(P, 1),
                                                                                 C--);
            if (!b && !x)
                for (; C--; C)
                    S.unshift("..");
            !b || "" === S[0] || S[0] && "/" === S[0].charAt(0) || S.unshift(""),
                M && "/" !== S.join("/").substr(-1) && S.push("");
            var E, O = "" === S[0] || S[0] && "/" === S[0].charAt(0);
            return I && (i.hostname = i.host = O ? "" : S.length ? S.shift() : "",
                         (E = !!(i.host && i.host.indexOf("@") > 0) && i.host.split("@")) && (i.auth = E.shift(),
                                                                                              i.host = i.hostname = E.shift())),
                (b = b || i.host && S.length) && !O && S.unshift(""),
                S.length ? i.pathname = S.join("/") : (i.pathname = null,
                                                       i.path = null),
                s.isNull(i.pathname) && s.isNull(i.search) || (i.path = (i.pathname ? i.pathname : "") + (i.search ? i.search : "")),
                i.auth = e.auth || i.auth,
                i.slashes = i.slashes || e.slashes,
                i.href = i.format(),
                i
        },
            o.prototype.parseHost = function() {
            var e = this.host,
                t = r.exec(e);
            t && (":" !== (t = t[0]) && (this.port = t.substr(1)),
                  e = e.substr(0, e.length - t.length)),
                e && (this.hostname = e)
        }
    }, function(e, t, i) {
        (function(e, n) {
            var s;
            /*! https://mths.be/punycode v1.4.1 by @mathias */
            ! function(o) {
                t && t.nodeType,
                    e && e.nodeType;
                var a = "object" == typeof n && n;
                a.global !== a && a.window !== a && a.self;
                var r, c = 2147483647,
                    l = 36,
                    h = /^xn--/,
                    u = /[^\x20-\x7E]/,
                    d = /[\x2E\u3002\uFF0E\uFF61]/g,
                    f = {
                        overflow: "Overflow: input needs wider integers to process",
                        "not-basic": "Illegal input >= 0x80 (not a basic code point)",
                        "invalid-input": "Invalid input"
                    },
                    p = Math.floor,
                    g = String.fromCharCode;

                function m(e) {
                    throw new RangeError(f[e])
                }

                function y(e, t) {
                    for (var i = e.length, n = []; i--;)
                        n[i] = t(e[i]);
                    return n
                }

                function k(e, t) {
                    var i = e.split("@"),
                        n = "";
                    return i.length > 1 && (n = i[0] + "@",
                                            e = i[1]),
                        n + y((e = e.replace(d, ".")).split("."), t).join(".")
                }

                function w(e) {
                    for (var t, i, n = [], s = 0, o = e.length; s < o;)
                        (t = e.charCodeAt(s++)) >= 55296 && t <= 56319 && s < o ? 56320 == (64512 & (i = e.charCodeAt(s++))) ? n.push(((1023 & t) << 10) + (1023 & i) + 65536) : (n.push(t),
                            s--) : n.push(t);
                    return n
                }

                function v(e) {
                    return y(e, (function(e) {
                        var t = "";
                        return e > 65535 && (t += g((e -= 65536) >>> 10 & 1023 | 55296),
                                             e = 56320 | 1023 & e),
                            t + g(e)
                    })).join("")
                }

                function b(e) {
                    return e - 48 < 10 ? e - 22 : e - 65 < 26 ? e - 65 : e - 97 < 26 ? e - 97 : l
                }

                function x(e, t) {
                    return e + 22 + 75 * (e < 26) - ((0 != t) << 5)
                }

                function S(e, t, i) {
                    var n = 0;
                    for (e = i ? p(e / 700) : e >> 1,
                         e += p(e / t); e > 455; n += l)
                        e = p(e / 35);
                    return p(n + 36 * e / (e + 38))
                }

                function I(e) {
                    var t, i, n, s, o, a, r, h, u, d, f = [],
                        g = e.length,
                        y = 0,
                        k = 128,
                        w = 72;
                    for ((i = e.lastIndexOf("-")) < 0 && (i = 0),
                         n = 0; n < i; ++n)
                        e.charCodeAt(n) >= 128 && m("not-basic"),
                            f.push(e.charCodeAt(n));
                    for (s = i > 0 ? i + 1 : 0; s < g;) {
                        for (o = y,
                             a = 1,
                             r = l; s >= g && m("invalid-input"),
                             ((h = b(e.charCodeAt(s++))) >= l || h > p((c - y) / a)) && m("overflow"),
                             y += h * a,
                             !(h < (u = r <= w ? 1 : r >= w + 26 ? 26 : r - w)); r += l)
                            a > p(c / (d = l - u)) && m("overflow"),
                                a *= d;
                        w = S(y - o, t = f.length + 1, 0 == o),
                            p(y / t) > c - k && m("overflow"),
                            k += p(y / t),
                            y %= t,
                            f.splice(y++, 0, k)
                    }
                    return v(f)
                }

                function T(e) {
                    var t, i, n, s, o, a, r, h, u, d, f, y, k, v, b, I = [];
                    for (y = (e = w(e)).length,
                         t = 128,
                         i = 0,
                         o = 72,
                         a = 0; a < y; ++a)
                        (f = e[a]) < 128 && I.push(g(f));
                    for (n = s = I.length,
                         s && I.push("-"); n < y;) {
                        for (r = c,
                             a = 0; a < y; ++a)
                            (f = e[a]) >= t && f < r && (r = f);
                        for (r - t > p((c - i) / (k = n + 1)) && m("overflow"),
                             i += (r - t) * k,
                             t = r,
                             a = 0; a < y; ++a)
                            if ((f = e[a]) < t && ++i > c && m("overflow"),
                                f == t) {
                                for (h = i,
                                     u = l; !(h < (d = u <= o ? 1 : u >= o + 26 ? 26 : u - o)); u += l)
                                    b = h - d,
                                        v = l - d,
                                        I.push(g(x(d + b % v, 0))),
                                        h = p(b / v);
                                I.push(g(x(h, 0))),
                                    o = S(i, k, n == s),
                                    i = 0,
                                    ++n
                            }
                        ++ i,
                            ++t
                    }
                    return I.join("")
                }
                r = {
                    version: "1.4.1",
                    ucs2: {
                        decode: w,
                        encode: v
                    },
                    decode: I,
                    encode: T,
                    toASCII: function(e) {
                        return k(e, (function(e) {
                            return u.test(e) ? "xn--" + T(e) : e
                        }))
                    },
                    toUnicode: function(e) {
                        return k(e, (function(e) {
                            return h.test(e) ? I(e.slice(4).toLowerCase()) : e
                        }))
                    }
                },
                    void 0 === (s = function() {
                    return r
                }
                                .call(t, i, t, e)) || (e.exports = s)
            }()
        }).call(this, i(26)(e), i(27))
    }, function(e, t) {
        e.exports = function(e) {
            return e.webpackPolyfill || (e.deprecate = function() {},
                                         e.paths = [],
                                         e.children || (e.children = []),
                                         Object.defineProperty(e, "loaded", {
                enumerable: !0,
                get: function() {
                    return e.l
                }
            }),
                                         Object.defineProperty(e, "id", {
                enumerable: !0,
                get: function() {
                    return e.i
                }
            }),
                                         e.webpackPolyfill = 1),
                e
        }
    }, function(e, t) {
        var i;
        i = function() {
            return this
        }();
        try {
            i = i || new Function("return this")()
        } catch (e) {
            "object" == typeof window && (i = window)
        }
        e.exports = i
    }, function(e, t, i) {
        "use strict";
        e.exports = {
            isString: function(e) {
                return "string" == typeof e
            },
            isObject: function(e) {
                return "object" == typeof e && null !== e
            },
            isNull: function(e) {
                return null === e
            },
            isNullOrUndefined: function(e) {
                return null == e
            }
        }
    }, function(e, t, i) {
        "use strict";
        t.decode = t.parse = i(30),
            t.encode = t.stringify = i(31)
    }, function(e, t, i) {
        "use strict";

        function n(e, t) {
            return Object.prototype.hasOwnProperty.call(e, t)
        }
        e.exports = function(e, t, i, o) {
            t = t || "&",
                i = i || "=";
            var a = {};
            if ("string" != typeof e || 0 === e.length)
                return a;
            var r = /\+/g;
            e = e.split(t);
            var c = 1e3;
            o && "number" == typeof o.maxKeys && (c = o.maxKeys);
            var l = e.length;
            c > 0 && l > c && (l = c);
            for (var h = 0; h < l; ++h) {
                var u, d, f, p, g = e[h].replace(r, "%20"),
                    m = g.indexOf(i);
                m >= 0 ? (u = g.substr(0, m),
                          d = g.substr(m + 1)) : (u = g,
                                                  d = ""),
                    f = decodeURIComponent(u),
                    p = decodeURIComponent(d),
                    n(a, f) ? s(a[f]) ? a[f].push(p) : a[f] = [a[f], p] : a[f] = p
            }
            return a
        };
        var s = Array.isArray || function(e) {
            return "[object Array]" === Object.prototype.toString.call(e)
        }
        }, function(e, t, i) {
            "use strict";
            var n = function(e) {
                switch (typeof e) {
                    case "string":
                        return e;
                    case "boolean":
                        return e ? "true" : "false";
                    case "number":
                        return isFinite(e) ? e : "";
                    default:
                        return ""
                }
            };
            e.exports = function(e, t, i, r) {
                return t = t || "&",
                    i = i || "=",
                    null === e && (e = void 0),
                    "object" == typeof e ? o(a(e), (function(a) {
                    var r = encodeURIComponent(n(a)) + i;
                    return s(e[a]) ? o(e[a], (function(e) {
                        return r + encodeURIComponent(n(e))
                    })).join(t) : r + encodeURIComponent(n(e[a]))
                })).join(t) : r ? encodeURIComponent(n(r)) + i + encodeURIComponent(n(e)) : ""
            };
            var s = Array.isArray || function(e) {
                return "[object Array]" === Object.prototype.toString.call(e)
            };

            function o(e, t) {
                if (e.map)
                    return e.map(t);
                for (var i = [], n = 0; n < e.length; n++)
                    i.push(t(e[n], n));
                return i
            }
            var a = Object.keys || function(e) {
                var t = [];
                for (var i in e)
                    Object.prototype.hasOwnProperty.call(e, i) && t.push(i);
                return t
            }
            }, function(e, t, i) {
                ! function() {
                    var t = i(33),
                        n = i(1).utf8,
                        s = i(34),
                        o = i(1).bin,
                        a = function(e, i) {
                            e.constructor == String ? e = i && "binary" === i.encoding ? o.stringToBytes(e) : n.stringToBytes(e) : s(e) ? e = Array.prototype.slice.call(e, 0) : Array.isArray(e) || (e = e.toString());
                            for (var r = t.bytesToWords(e), c = 8 * e.length, l = 1732584193, h = -271733879, u = -1732584194, d = 271733878, f = 0; f < r.length; f++)
                                r[f] = 16711935 & (r[f] << 8 | r[f] >>> 24) | 4278255360 & (r[f] << 24 | r[f] >>> 8);
                            r[c >>> 5] |= 128 << c % 32,
                                r[14 + (c + 64 >>> 9 << 4)] = c;
                            var p = a._ff,
                                g = a._gg,
                                m = a._hh,
                                y = a._ii;
                            for (f = 0; f < r.length; f += 16) {
                                var k = l,
                                    w = h,
                                    v = u,
                                    b = d;
                                h = y(h = y(h = y(h = y(h = m(h = m(h = m(h = m(h = g(h = g(h = g(h = g(h = p(h = p(h = p(h = p(h, u = p(u, d = p(d, l = p(l, h, u, d, r[f + 0], 7, -680876936), h, u, r[f + 1], 12, -389564586), l, h, r[f + 2], 17, 606105819), d, l, r[f + 3], 22, -1044525330), u = p(u, d = p(d, l = p(l, h, u, d, r[f + 4], 7, -176418897), h, u, r[f + 5], 12, 1200080426), l, h, r[f + 6], 17, -1473231341), d, l, r[f + 7], 22, -45705983), u = p(u, d = p(d, l = p(l, h, u, d, r[f + 8], 7, 1770035416), h, u, r[f + 9], 12, -1958414417), l, h, r[f + 10], 17, -42063), d, l, r[f + 11], 22, -1990404162), u = p(u, d = p(d, l = p(l, h, u, d, r[f + 12], 7, 1804603682), h, u, r[f + 13], 12, -40341101), l, h, r[f + 14], 17, -1502002290), d, l, r[f + 15], 22, 1236535329), u = g(u, d = g(d, l = g(l, h, u, d, r[f + 1], 5, -165796510), h, u, r[f + 6], 9, -1069501632), l, h, r[f + 11], 14, 643717713), d, l, r[f + 0], 20, -373897302), u = g(u, d = g(d, l = g(l, h, u, d, r[f + 5], 5, -701558691), h, u, r[f + 10], 9, 38016083), l, h, r[f + 15], 14, -660478335), d, l, r[f + 4], 20, -405537848), u = g(u, d = g(d, l = g(l, h, u, d, r[f + 9], 5, 568446438), h, u, r[f + 14], 9, -1019803690), l, h, r[f + 3], 14, -187363961), d, l, r[f + 8], 20, 1163531501), u = g(u, d = g(d, l = g(l, h, u, d, r[f + 13], 5, -1444681467), h, u, r[f + 2], 9, -51403784), l, h, r[f + 7], 14, 1735328473), d, l, r[f + 12], 20, -1926607734), u = m(u, d = m(d, l = m(l, h, u, d, r[f + 5], 4, -378558), h, u, r[f + 8], 11, -2022574463), l, h, r[f + 11], 16, 1839030562), d, l, r[f + 14], 23, -35309556), u = m(u, d = m(d, l = m(l, h, u, d, r[f + 1], 4, -1530992060), h, u, r[f + 4], 11, 1272893353), l, h, r[f + 7], 16, -155497632), d, l, r[f + 10], 23, -1094730640), u = m(u, d = m(d, l = m(l, h, u, d, r[f + 13], 4, 681279174), h, u, r[f + 0], 11, -358537222), l, h, r[f + 3], 16, -722521979), d, l, r[f + 6], 23, 76029189), u = m(u, d = m(d, l = m(l, h, u, d, r[f + 9], 4, -640364487), h, u, r[f + 12], 11, -421815835), l, h, r[f + 15], 16, 530742520), d, l, r[f + 2], 23, -995338651), u = y(u, d = y(d, l = y(l, h, u, d, r[f + 0], 6, -198630844), h, u, r[f + 7], 10, 1126891415), l, h, r[f + 14], 15, -1416354905), d, l, r[f + 5], 21, -57434055), u = y(u, d = y(d, l = y(l, h, u, d, r[f + 12], 6, 1700485571), h, u, r[f + 3], 10, -1894986606), l, h, r[f + 10], 15, -1051523), d, l, r[f + 1], 21, -2054922799), u = y(u, d = y(d, l = y(l, h, u, d, r[f + 8], 6, 1873313359), h, u, r[f + 15], 10, -30611744), l, h, r[f + 6], 15, -1560198380), d, l, r[f + 13], 21, 1309151649), u = y(u, d = y(d, l = y(l, h, u, d, r[f + 4], 6, -145523070), h, u, r[f + 11], 10, -1120210379), l, h, r[f + 2], 15, 718787259), d, l, r[f + 9], 21, -343485551),
                                    l = l + k >>> 0,
                                    h = h + w >>> 0,
                                    u = u + v >>> 0,
                                    d = d + b >>> 0
                            }
                            return t.endian([l, h, u, d])
                        };
                    a._ff = function(e, t, i, n, s, o, a) {
                        var r = e + (t & i | ~t & n) + (s >>> 0) + a;
                        return (r << o | r >>> 32 - o) + t
                    },
                        a._gg = function(e, t, i, n, s, o, a) {
                        var r = e + (t & n | i & ~n) + (s >>> 0) + a;
                        return (r << o | r >>> 32 - o) + t
                    },
                        a._hh = function(e, t, i, n, s, o, a) {
                        var r = e + (t ^ i ^ n) + (s >>> 0) + a;
                        return (r << o | r >>> 32 - o) + t
                    },
                        a._ii = function(e, t, i, n, s, o, a) {
                        var r = e + (i ^ (t | ~n)) + (s >>> 0) + a;
                        return (r << o | r >>> 32 - o) + t
                    },
                        a._blocksize = 16,
                        a._digestsize = 16,
                        e.exports = function(e, i) {
                        if (null == e)
                            throw new Error("Illegal argument " + e);
                        var n = t.wordsToBytes(a(e, i));
                        return i && i.asBytes ? n : i && i.asString ? o.bytesToString(n) : t.bytesToHex(n)
                    }
                }()
            }, function(e, t) {
                ! function() {
                    var t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
                        i = {
                            rotl: function(e, t) {
                                return e << t | e >>> 32 - t
                            },
                            rotr: function(e, t) {
                                return e << 32 - t | e >>> t
                            },
                            endian: function(e) {
                                if (e.constructor == Number)
                                    return 16711935 & i.rotl(e, 8) | 4278255360 & i.rotl(e, 24);
                                for (var t = 0; t < e.length; t++)
                                    e[t] = i.endian(e[t]);
                                return e
                            },
                            randomBytes: function(e) {
                                for (var t = []; e > 0; e--)
                                    t.push(Math.floor(256 * Math.random()));
                                return t
                            },
                            bytesToWords: function(e) {
                                for (var t = [], i = 0, n = 0; i < e.length; i++,
                                     n += 8)
                                    t[n >>> 5] |= e[i] << 24 - n % 32;
                                return t
                            },
                            wordsToBytes: function(e) {
                                for (var t = [], i = 0; i < 32 * e.length; i += 8)
                                    t.push(e[i >>> 5] >>> 24 - i % 32 & 255);
                                return t
                            },
                            bytesToHex: function(e) {
                                for (var t = [], i = 0; i < e.length; i++)
                                    t.push((e[i] >>> 4).toString(16)),
                                        t.push((15 & e[i]).toString(16));
                                return t.join("")
                            },
                            hexToBytes: function(e) {
                                for (var t = [], i = 0; i < e.length; i += 2)
                                    t.push(parseInt(e.substr(i, 2), 16));
                                return t
                            },
                            bytesToBase64: function(e) {
                                for (var i = [], n = 0; n < e.length; n += 3)
                                    for (var s = e[n] << 16 | e[n + 1] << 8 | e[n + 2], o = 0; o < 4; o++)
                                        8 * n + 6 * o <= 8 * e.length ? i.push(t.charAt(s >>> 6 * (3 - o) & 63)) : i.push("=");
                                return i.join("")
                            },
                            base64ToBytes: function(e) {
                                e = e.replace(/[^A-Z0-9+\/]/gi, "");
                                for (var i = [], n = 0, s = 0; n < e.length; s = ++n % 4)
                                    0 != s && i.push((t.indexOf(e.charAt(n - 1)) & Math.pow(2, -2 * s + 8) - 1) << 2 * s | t.indexOf(e.charAt(n)) >>> 6 - 2 * s);
                                return i
                            }
                        };
                    e.exports = i
                }()
            }, function(e, t) {
                function i(e) {
                    return !!e.constructor && "function" == typeof e.constructor.isBuffer && e.constructor.isBuffer(e)
                }
                /*!
         * Determine if an object is a Buffer
         *
         * @author   Feross Aboukhadijeh <https://feross.org>
         * @license  MIT
         */
                e.exports = function(e) {
                    return null != e && (i(e) || function(e) {
                        return "function" == typeof e.readFloatLE && "function" == typeof e.slice && i(e.slice(0, 0))
                    }(e) || !!e._isBuffer)
                }
            }, function(e, t) {
                e.exports = function(e, t, i, n, s, o, a, r, c) {
                    this.aiTypes = [{
                        id: 0,
                        src: "cow_1",
                        killScore: 150,
                        health: 500,
                        weightM: .8,
                        speed: 95e-5,
                        turnSpeed: .001,
                        scale: 72,
                        drop: ["food", 50]
                    }, {
                        id: 1,
                        src: "pig_1",
                        killScore: 200,
                        health: 800,
                        weightM: .6,
                        speed: 85e-5,
                        turnSpeed: .001,
                        scale: 72,
                        drop: ["food", 80]
                    }, {
                        id: 2,
                        name: "Bull",
                        src: "bull_2",
                        hostile: !0,
                        dmg: 20,
                        killScore: 1e3,
                        health: 1800,
                        weightM: .5,
                        speed: 94e-5,
                        turnSpeed: 74e-5,
                        scale: 78,
                        viewRange: 800,
                        chargePlayer: !0,
                        drop: ["food", 100]
                    }, {
                        id: 3,
                        name: "Bully",
                        src: "bull_1",
                        hostile: !0,
                        dmg: 20,
                        killScore: 2e3,
                        health: 2800,
                        weightM: .45,
                        speed: .001,
                        turnSpeed: 8e-4,
                        scale: 90,
                        viewRange: 900,
                        chargePlayer: !0,
                        drop: ["food", 400]
                    }, {
                        id: 4,
                        name: "Wolf",
                        src: "wolf_1",
                        hostile: !0,
                        dmg: 8,
                        killScore: 500,
                        health: 300,
                        weightM: .45,
                        speed: .001,
                        turnSpeed: .002,
                        scale: 84,
                        viewRange: 800,
                        chargePlayer: !0,
                        drop: ["food", 200]
                    }, {
                        id: 5,
                        name: "Quack",
                        src: "chicken_1",
                        dmg: 8,
                        killScore: 2e3,
                        noTrap: !0,
                        health: 300,
                        weightM: .2,
                        speed: .0018,
                        turnSpeed: .006,
                        scale: 70,
                        drop: ["food", 100]
                    }, {
                        id: 6,
                        name: "MOOSTAFA",
                        nameScale: 50,
                        src: "enemy",
                        hostile: !0,
                        dontRun: !0,
                        fixedSpawn: !0,
                        spawnDelay: 6e4,
                        noTrap: !0,
                        colDmg: 100,
                        dmg: 40,
                        killScore: 8e3,
                        health: 18e3,
                        weightM: .4,
                        speed: 7e-4,
                        turnSpeed: .01,
                        scale: 80,
                        spriteMlt: 1.8,
                        leapForce: .9,
                        viewRange: 1e3,
                        hitRange: 210,
                        hitDelay: 1e3,
                        chargePlayer: !0,
                        drop: ["food", 100]
                    }, {
                        id: 7,
                        name: "Treasure",
                        hostile: !0,
                        nameScale: 35,
                        src: "crate_1",
                        fixedSpawn: !0,
                        spawnDelay: 12e4,
                        colDmg: 200,
                        killScore: 5e3,
                        health: 2e4,
                        weightM: .1,
                        speed: 0,
                        turnSpeed: 0,
                        scale: 70,
                        spriteMlt: 1
                    }, {
                        id: 8,
                        name: "MOOFIE",
                        src: "wolf_2",
                        hostile: !0,
                        fixedSpawn: !0,
                        dontRun: !0,
                        hitScare: 4,
                        spawnDelay: 3e4,
                        noTrap: !0,
                        nameScale: 35,
                        dmg: 10,
                        colDmg: 100,
                        killScore: 3e3,
                        health: 7e3,
                        weightM: .45,
                        speed: .0015,
                        turnSpeed: .002,
                        scale: 90,
                        viewRange: 800,
                        chargePlayer: !0,
                        drop: ["food", 1e3]
                    }],
                        this.spawn = function(l, h, u, d) {
                        for (var f, p = 0; p < e.length; ++p)
                            if (!e[p].active) {
                                f = e[p];
                                break
                            }
                        return f || (f = new t(e.length, s, i, n, a, o, r, c),
                                     e.push(f)),
                            f.init(l, h, u, d, this.aiTypes[d]),
                            f
                    }
                }
            }, function(e, t) {
                var i = 2 * Math.PI;
                e.exports = function(e, t, n, s, o, a, r, c) {
                    this.sid = e,
                        this.isAI = !0,
                        this.nameIndex = o.randInt(0, a.cowNames.length - 1),
                        this.init = function(e, t, i, n, s) {
                        this.x = e,
                            this.y = t,
                            this.startX = s.fixedSpawn ? e : null,
                            this.startY = s.fixedSpawn ? t : null,
                            this.xVel = 0,
                            this.yVel = 0,
                            this.zIndex = 0,
                            this.dir = i,
                            this.dirPlus = 0,
                            this.index = n,
                            this.src = s.src,
                            s.name && (this.name = s.name),
                            this.weightM = s.weightM,
                            this.speed = s.speed,
                            this.killScore = s.killScore,
                            this.turnSpeed = s.turnSpeed,
                            this.scale = s.scale,
                            this.maxHealth = s.health,
                            this.leapForce = s.leapForce,
                            this.health = this.maxHealth,
                            this.chargePlayer = s.chargePlayer,
                            this.viewRange = s.viewRange,
                            this.drop = s.drop,
                            this.dmg = s.dmg,
                            this.hostile = s.hostile,
                            this.dontRun = s.dontRun,
                            this.hitRange = s.hitRange,
                            this.hitDelay = s.hitDelay,
                            this.hitScare = s.hitScare,
                            this.spriteMlt = s.spriteMlt,
                            this.nameScale = s.nameScale,
                            this.colDmg = s.colDmg,
                            this.noTrap = s.noTrap,
                            this.spawnDelay = s.spawnDelay,
                            this.hitWait = 0,
                            this.waitCount = 1e3,
                            this.moveCount = 0,
                            this.targetDir = 0,
                            this.active = !0,
                            this.alive = !0,
                            this.runFrom = null,
                            this.chargeTarget = null,
                            this.dmgOverTime = {}
                    };
                    var l = 0;
                    this.update = function(e) {
                        if (this.active) {
                            if (this.spawnCounter)
                                return this.spawnCounter -= e,
                                    void(this.spawnCounter <= 0 && (this.spawnCounter = 0,
                                                                    this.x = this.startX || o.randInt(0, a.mapScale),
                                                                    this.y = this.startY || o.randInt(0, a.mapScale)));
                            (l -= e) <= 0 && (this.dmgOverTime.dmg && (this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer),
                                                                       this.dmgOverTime.time -= 1,
                                                                       this.dmgOverTime.time <= 0 && (this.dmgOverTime.dmg = 0)),
                                              l = 1e3);
                            var s = !1,
                                r = 1;
                            if (!this.zIndex && !this.lockMove && this.y >= a.mapScale / 2 - a.riverWidth / 2 && this.y <= a.mapScale / 2 + a.riverWidth / 2 && (r = .33,
                                this.xVel += a.waterCurrent * e),
                                this.lockMove)
                                this.xVel = 0,
                                    this.yVel = 0;
                            else if (this.waitCount > 0) {
                                if (this.waitCount -= e,
                                    this.waitCount <= 0)
                                    if (this.chargePlayer) {
                                        for (var h, u, d, f = 0; f < n.length; ++f)
                                            !n[f].alive || n[f].skin && n[f].skin.bullRepel || (d = o.getDistance(this.x, this.y, n[f].x, n[f].y)) <= this.viewRange && (!h || d < u) && (u = d,
                                            h = n[f]);
                                        h ? (this.chargeTarget = h,
                                             this.moveCount = o.randInt(8e3, 12e3)) : (this.moveCount = o.randInt(1e3, 2e3),
                                                                                       this.targetDir = o.randFloat(-Math.PI, Math.PI))
                                    } else
                                        this.moveCount = o.randInt(4e3, 1e4),
                                            this.targetDir = o.randFloat(-Math.PI, Math.PI)
                            } else if (this.moveCount > 0) {
                                var p = this.speed * r;
                                if (this.runFrom && this.runFrom.active && (!this.runFrom.isPlayer || this.runFrom.alive) ? (this.targetDir = o.getDirection(this.x, this.y, this.runFrom.x, this.runFrom.y),
                                                                                                                             p *= 1.42) : this.chargeTarget && this.chargeTarget.alive && (this.targetDir = o.getDirection(this.chargeTarget.x, this.chargeTarget.y, this.x, this.y),
                                    p *= 1.75,
                                    s = !0),
                                    this.hitWait && (p *= .3),
                                    this.dir != this.targetDir) {
                                    this.dir %= i;
                                    var g = (this.dir - this.targetDir + i) % i,
                                        m = Math.min(Math.abs(g - i), g, this.turnSpeed * e),
                                        y = g - Math.PI >= 0 ? 1 : -1;
                                    this.dir += y * m + i
                                }
                                this.dir %= i,
                                    this.xVel += p * e * Math.cos(this.dir),
                                    this.yVel += p * e * Math.sin(this.dir),
                                    this.moveCount -= e,
                                    this.moveCount <= 0 && (this.runFrom = null,
                                                            this.chargeTarget = null,
                                                            this.waitCount = this.hostile ? 1500 : o.randInt(1500, 6e3))
                            }
                            this.zIndex = 0,
                                this.lockMove = !1;
                            var k = o.getDistance(0, 0, this.xVel * e, this.yVel * e),
                                w = Math.min(4, Math.max(1, Math.round(k / 40))),
                                v = 1 / w;
                            for (f = 0; f < w; ++f) {
                                this.xVel && (this.x += this.xVel * e * v),
                                    this.yVel && (this.y += this.yVel * e * v),
                                    C = t.getGridArrays(this.x, this.y, this.scale);
                                for (var b = 0; b < C.length; ++b)
                                    for (var x = 0; x < C[b].length; ++x)
                                        C[b][x].active && t.checkCollision(this, C[b][x], v)
                            }
                            var S, I, T, M = !1;
                            if (this.hitWait > 0 && (this.hitWait -= e,
                                                     this.hitWait <= 0)) {
                                M = !0,
                                    this.hitWait = 0,
                                    this.leapForce && !o.randInt(0, 2) && (this.xVel += this.leapForce * Math.cos(this.dir),
                                                                           this.yVel += this.leapForce * Math.sin(this.dir));
                                for (var C = t.getGridArrays(this.x, this.y, this.hitRange), P = 0; P < C.length; ++P)
                                    for (b = 0; b < C[P].length; ++b)
                                        (S = C[P][b]).health && (I = o.getDistance(this.x, this.y, S.x, S.y)) < S.scale + this.hitRange && (S.changeHealth(5 * -this.dmg) && t.disableObj(S),
                                                                                                                                            t.hitObj(S, o.getDirection(this.x, this.y, S.x, S.y)));
                                for (b = 0; b < n.length; ++b)
                                    n[b].canSee(this) && c.send(n[b].id, "aa", this.sid)
                            }
                            if (s || M)
                                for (f = 0; f < n.length; ++f)
                                    (S = n[f]) && S.alive && (I = o.getDistance(this.x, this.y, S.x, S.y),
                                                              this.hitRange ? !this.hitWait && I <= this.hitRange + S.scale && (M ? (T = o.getDirection(S.x, S.y, this.x, this.y),
                                                                                                                                     S.changeHealth(-this.dmg),
                                                                                                                                     S.xVel += .6 * Math.cos(T),
                                                                                                                                     S.yVel += .6 * Math.sin(T),
                                                                                                                                     this.runFrom = null,
                                                                                                                                     this.chargeTarget = null,
                                                                                                                                     this.waitCount = 3e3,
                                                                                                                                     this.hitWait = o.randInt(0, 2) ? 0 : 600) : this.hitWait = this.hitDelay) : I <= this.scale + S.scale && (T = o.getDirection(S.x, S.y, this.x, this.y),
                                        S.changeHealth(-this.dmg),
                                        S.xVel += .55 * Math.cos(T),
                                        S.yVel += .55 * Math.sin(T)));
                            this.xVel && (this.xVel *= Math.pow(a.playerDecel, e)),
                                this.yVel && (this.yVel *= Math.pow(a.playerDecel, e));
                            var E = this.scale;
                            this.x - E < 0 ? (this.x = E,
                                              this.xVel = 0) : this.x + E > a.mapScale && (this.x = a.mapScale - E,
                                                                                           this.xVel = 0),
                                this.y - E < 0 ? (this.y = E,
                                                  this.yVel = 0) : this.y + E > a.mapScale && (this.y = a.mapScale - E,
                                                                                               this.yVel = 0)
                        }
                    },
                        this.canSee = function(e) {
                        if (!e)
                            return !1;
                        if (e.skin && e.skin.invisTimer && e.noMovTimer >= e.skin.invisTimer)
                            return !1;
                        var t = Math.abs(e.x - this.x) - e.scale,
                            i = Math.abs(e.y - this.y) - e.scale;
                        return t <= a.maxScreenWidth / 2 * 1.3 && i <= a.maxScreenHeight / 2 * 1.3
                    };
                    var h = 0,
                        u = 0;
                    this.animate = function(e) {
                        this.animTime > 0 && (this.animTime -= e,
                                              this.animTime <= 0 ? (this.animTime = 0,
                                                                    this.dirPlus = 0,
                                                                    h = 0,
                                                                    u = 0) : 0 == u ? (h += e / (this.animSpeed * a.hitReturnRatio),
                                                                                       this.dirPlus = o.lerp(0, this.targetAngle, Math.min(1, h)),
                                                                                       h >= 1 && (h = 1,
                                                                                                  u = 1)) : (h -= e / (this.animSpeed * (1 - a.hitReturnRatio)),
                                                                                                             this.dirPlus = o.lerp(0, this.targetAngle, Math.max(0, h))))
                    },
                        this.startAnim = function() {
                        this.animTime = this.animSpeed = 600,
                            this.targetAngle = .8 * Math.PI,
                            h = 0,
                            u = 0
                    },
                        this.changeHealth = function(e, t, i) {
                        if (this.active && (this.health += e,
                                            i && (this.hitScare && !o.randInt(0, this.hitScare) ? (this.runFrom = i,
                                                                                                   this.waitCount = 0,
                                                                                                   this.moveCount = 2e3) : this.hostile && this.chargePlayer && i.isPlayer ? (this.chargeTarget = i,
                                this.waitCount = 0,
                                this.moveCount = 8e3) : this.dontRun || (this.runFrom = i,
                                                                         this.waitCount = 0,
                                                                         this.moveCount = 2e3)),
                                            e < 0 && this.hitRange && o.randInt(0, 1) && (this.hitWait = 500),
                                            t && t.canSee(this) && e < 0 && c.send(t.id, "t", Math.round(this.x), Math.round(this.y), Math.round(-e), 1),
                                            this.health <= 0 && (this.spawnDelay ? (this.spawnCounter = this.spawnDelay,
                                                                                    this.x = -1e6,
                                                                                    this.y = -1e6) : (this.x = this.startX || o.randInt(0, a.mapScale),
                                                                                                      this.y = this.startY || o.randInt(0, a.mapScale)),
                                                                 this.health = this.maxHealth,
                                                                 this.runFrom = null,
                                                                 t && (r(t, this.killScore),
                                                                       this.drop))))
                            for (var n = 0; n < this.drop.length;)
                                t.addResource(a.resourceTypes.indexOf(this.drop[n]), this.drop[n + 1]),
                                    n += 2
                    }
                }
            }, function(e, t, i) {
                "use strict";
                i.r(t);
                var n, s, o, a = 4294967295;

                function r(e, t, i) {
                    var n = Math.floor(i / 4294967296),
                        s = i;
                    e.setUint32(t, n),
                        e.setUint32(t + 4, s)
                }

                function c(e, t) {
                    return 4294967296 * e.getInt32(t) + e.getUint32(t + 4)
                }
                var l = ("undefined" == typeof process || "never" !== (null === (n = null === process || void 0 === process ? void 0 : process.env) || void 0 === n ? void 0 : n.TEXT_ENCODING)) && "undefined" != typeof TextEncoder && "undefined" != typeof TextDecoder;

                function h(e) {
                    for (var t = e.length, i = 0, n = 0; n < t;) {
                        var s = e.charCodeAt(n++);
                        if (0 != (4294967168 & s))
                            if (0 == (4294965248 & s))
                                i += 2;
                            else {
                                if (s >= 55296 && s <= 56319 && n < t) {
                                    var o = e.charCodeAt(n);
                                    56320 == (64512 & o) && (++n,
                                                             s = ((1023 & s) << 10) + (1023 & o) + 65536)
                                }
                                i += 0 == (4294901760 & s) ? 3 : 4
                            }
                        else
                            i++
                    }
                    return i
                }
                var u = l ? new TextEncoder : void 0,
                    d = l ? "undefined" != typeof process && "force" !== (null === (s = null === process || void 0 === process ? void 0 : process.env) || void 0 === s ? void 0 : s.TEXT_ENCODING) ? 200 : 0 : a,
                    f = (null == u ? void 0 : u.encodeInto) ? function(e, t, i) {
                        u.encodeInto(e, t.subarray(i))
                    } :
                function(e, t, i) {
                    t.set(u.encode(e), i)
                };

                function p(e, t, i) {
                    for (var n = t, s = n + i, o = [], a = ""; n < s;) {
                        var r = e[n++];
                        if (0 == (128 & r))
                            o.push(r);
                        else if (192 == (224 & r)) {
                            var c = 63 & e[n++];
                            o.push((31 & r) << 6 | c)
                        } else if (224 == (240 & r)) {
                            c = 63 & e[n++];
                            var l = 63 & e[n++];
                            o.push((31 & r) << 12 | c << 6 | l)
                        } else if (240 == (248 & r)) {
                            var h = (7 & r) << 18 | (c = 63 & e[n++]) << 12 | (l = 63 & e[n++]) << 6 | 63 & e[n++];
                            h > 65535 && (h -= 65536,
                                          o.push(h >>> 10 & 1023 | 55296),
                                          h = 56320 | 1023 & h),
                                o.push(h)
                        } else
                            o.push(r);
                        o.length >= 4096 && (a += String.fromCharCode.apply(String, o),
                                             o.length = 0)
                    }
                    return o.length > 0 && (a += String.fromCharCode.apply(String, o)),
                        a
                }
                var g = l ? new TextDecoder : null,
                    m = l ? "undefined" != typeof process && "force" !== (null === (o = null === process || void 0 === process ? void 0 : process.env) || void 0 === o ? void 0 : o.TEXT_DECODER) ? 200 : 0 : a,
                    y = function(e, t) {
                        this.type = e,
                            this.data = t
                    },
                    k = function() {
                        var e = function(t, i) {
                            return (e = Object.setPrototypeOf || {
                                __proto__: []
                            }
                                    instanceof Array && function(e, t) {
                                e.__proto__ = t
                            } ||
                                    function(e, t) {
                                for (var i in t)
                                    Object.prototype.hasOwnProperty.call(t, i) && (e[i] = t[i])
                            }
                                   )(t, i)
                        };
                        return function(t, i) {
                            if ("function" != typeof i && null !== i)
                                throw new TypeError("Class extends value " + String(i) + " is not a constructor or null");

                            function n() {
                                this.constructor = t
                            }
                            e(t, i),
                                t.prototype = null === i ? Object.create(i) : (n.prototype = i.prototype,
                                                                               new n)
                        }
                    }(),
                    w = function(e) {
                        function t(i) {
                            var n = e.call(this, i) || this,
                                s = Object.create(t.prototype);
                            return Object.setPrototypeOf(n, s),
                                Object.defineProperty(n, "name", {
                                configurable: !0,
                                enumerable: !1,
                                value: t.name
                            }),
                                n
                        }
                        return k(t, e),
                            t
                    }(Error);

                function v(e) {
                    var t, i = e.sec,
                        n = e.nsec;
                    if (i >= 0 && n >= 0 && i <= 17179869183) {
                        if (0 === n && i <= 4294967295) {
                            var s = new Uint8Array(4);
                            return (t = new DataView(s.buffer)).setUint32(0, i),
                                s
                        }
                        var o = i / 4294967296,
                            a = 4294967295 & i;
                        return s = new Uint8Array(8),
                            (t = new DataView(s.buffer)).setUint32(0, n << 2 | 3 & o),
                            t.setUint32(4, a),
                            s
                    }
                    return s = new Uint8Array(12),
                        (t = new DataView(s.buffer)).setUint32(0, n),
                        r(t, 4, i),
                        s
                }

                function b(e) {
                    var t = e.getTime(),
                        i = Math.floor(t / 1e3),
                        n = 1e6 * (t - 1e3 * i),
                        s = Math.floor(n / 1e9);
                    return {
                        sec: i + s,
                        nsec: n - 1e9 * s
                    }
                }

                function x(e) {
                    return e instanceof Date ? v(b(e)) : null
                }

                function S(e) {
                    var t = new DataView(e.buffer, e.byteOffset, e.byteLength);
                    switch (e.byteLength) {
                        case 4:
                            return {
                                sec: t.getUint32(0),
                                nsec: 0
                            };
                        case 8:
                            var i = t.getUint32(0);
                            return {
                                sec: 4294967296 * (3 & i) + t.getUint32(4),
                                nsec: i >>> 2
                            };
                        case 12:
                            return {
                                sec: c(t, 4),
                                nsec: t.getUint32(0)
                            };
                        default:
                            throw new w("Unrecognized data size for timestamp (expected 4, 8, or 12): ".concat(e.length))
                    }
                }

                function I(e) {
                    var t = S(e);
                    return new Date(1e3 * t.sec + t.nsec / 1e6)
                }
                var T = {
                    type: -1,
                    encode: x,
                    decode: I
                },
                    M = function() {
                        function e() {
                            this.builtInEncoders = [],
                                this.builtInDecoders = [],
                                this.encoders = [],
                                this.decoders = [],
                                this.register(T)
                        }
                        return e.prototype.register = function(e) {
                            var t = e.type,
                                i = e.encode,
                                n = e.decode;
                            if (t >= 0)
                                this.encoders[t] = i,
                                    this.decoders[t] = n;
                            else {
                                var s = 1 + t;
                                this.builtInEncoders[s] = i,
                                    this.builtInDecoders[s] = n
                            }
                        },
                            e.prototype.tryToEncode = function(e, t) {
                            for (var i = 0; i < this.builtInEncoders.length; i++)
                                if (null != (n = this.builtInEncoders[i]) && null != (s = n(e, t)))
                                    return new y(-1 - i, s);
                            for (i = 0; i < this.encoders.length; i++) {
                                var n, s;
                                if (null != (n = this.encoders[i]) && null != (s = n(e, t)))
                                    return new y(i, s)
                            }
                            return e instanceof y ? e : null
                        },
                            e.prototype.decode = function(e, t, i) {
                            var n = t < 0 ? this.builtInDecoders[-1 - t] : this.decoders[t];
                            return n ? n(e, t, i) : new y(t, e)
                        },
                            e.defaultCodec = new e,
                            e
                    }();

                function C(e) {
                    return e instanceof Uint8Array ? e : ArrayBuffer.isView(e) ? new Uint8Array(e.buffer, e.byteOffset, e.byteLength) : e instanceof ArrayBuffer ? new Uint8Array(e) : Uint8Array.from(e)
                }
                var P = function() {
                    function e(e, t, i, n, s, o, a, r) {
                        void 0 === e && (e = M.defaultCodec),
                            void 0 === t && (t = void 0),
                            void 0 === i && (i = 100),
                            void 0 === n && (n = 2048),
                            void 0 === s && (s = !1),
                            void 0 === o && (o = !1),
                            void 0 === a && (a = !1),
                            void 0 === r && (r = !1),
                            this.extensionCodec = e,
                            this.context = t,
                            this.maxDepth = i,
                            this.initialBufferSize = n,
                            this.sortKeys = s,
                            this.forceFloat32 = o,
                            this.ignoreUndefined = a,
                            this.forceIntegerToFloat = r,
                            this.pos = 0,
                            this.view = new DataView(new ArrayBuffer(this.initialBufferSize)),
                            this.bytes = new Uint8Array(this.view.buffer)
                    }
                    return e.prototype.reinitializeState = function() {
                        this.pos = 0
                    },
                        e.prototype.encodeSharedRef = function(e) {
                        return this.reinitializeState(),
                            this.doEncode(e, 1),
                            this.bytes.subarray(0, this.pos)
                    },
                        e.prototype.encode = function(e) {
                        return this.reinitializeState(),
                            this.doEncode(e, 1),
                            this.bytes.slice(0, this.pos)
                    },
                        e.prototype.doEncode = function(e, t) {
                        if (t > this.maxDepth)
                            throw new Error("Too deep objects in depth ".concat(t));
                        null == e ? this.encodeNil() : "boolean" == typeof e ? this.encodeBoolean(e) : "number" == typeof e ? this.encodeNumber(e) : "string" == typeof e ? this.encodeString(e) : this.encodeObject(e, t)
                    },
                        e.prototype.ensureBufferSizeToWrite = function(e) {
                        var t = this.pos + e;
                        this.view.byteLength < t && this.resizeBuffer(2 * t)
                    },
                        e.prototype.resizeBuffer = function(e) {
                        var t = new ArrayBuffer(e),
                            i = new Uint8Array(t),
                            n = new DataView(t);
                        i.set(this.bytes),
                            this.view = n,
                            this.bytes = i
                    },
                        e.prototype.encodeNil = function() {
                        this.writeU8(192)
                    },
                        e.prototype.encodeBoolean = function(e) {
                        !1 === e ? this.writeU8(194) : this.writeU8(195)
                    },
                        e.prototype.encodeNumber = function(e) {
                        Number.isSafeInteger(e) && !this.forceIntegerToFloat ? e >= 0 ? e < 128 ? this.writeU8(e) : e < 256 ? (this.writeU8(204),
                                                                                                                               this.writeU8(e)) : e < 65536 ? (this.writeU8(205),
                            this.writeU16(e)) : e < 4294967296 ? (this.writeU8(206),
                                                                  this.writeU32(e)) : (this.writeU8(207),
                                                                                       this.writeU64(e)) : e >= -32 ? this.writeU8(224 | e + 32) : e >= -128 ? (this.writeU8(208),
                            this.writeI8(e)) : e >= -32768 ? (this.writeU8(209),
                                                              this.writeI16(e)) : e >= -2147483648 ? (this.writeU8(210),
                                                                                                      this.writeI32(e)) : (this.writeU8(211),
                                                                                                                           this.writeI64(e)) : this.forceFloat32 ? (this.writeU8(202),
                            this.writeF32(e)) : (this.writeU8(203),
                                                 this.writeF64(e))
                    },
                        e.prototype.writeStringHeader = function(e) {
                        if (e < 32)
                            this.writeU8(160 + e);
                        else if (e < 256)
                            this.writeU8(217),
                                this.writeU8(e);
                        else if (e < 65536)
                            this.writeU8(218),
                                this.writeU16(e);
                        else {
                            if (!(e < 4294967296))
                                throw new Error("Too long string: ".concat(e, " bytes in UTF-8"));
                            this.writeU8(219),
                                this.writeU32(e)
                        }
                    },
                        e.prototype.encodeString = function(e) {
                        if (e.length > d) {
                            var t = h(e);
                            this.ensureBufferSizeToWrite(5 + t),
                                this.writeStringHeader(t),
                                f(e, this.bytes, this.pos),
                                this.pos += t
                        } else
                            t = h(e),
                                this.ensureBufferSizeToWrite(5 + t),
                                this.writeStringHeader(t),
                                function(e, t, i) {
                                for (var n = e.length, s = i, o = 0; o < n;) {
                                    var a = e.charCodeAt(o++);
                                    if (0 != (4294967168 & a)) {
                                        if (0 == (4294965248 & a))
                                            t[s++] = a >> 6 & 31 | 192;
                                        else {
                                            if (a >= 55296 && a <= 56319 && o < n) {
                                                var r = e.charCodeAt(o);
                                                56320 == (64512 & r) && (++o,
                                                                         a = ((1023 & a) << 10) + (1023 & r) + 65536)
                                            }
                                            0 == (4294901760 & a) ? (t[s++] = a >> 12 & 15 | 224,
                                                                     t[s++] = a >> 6 & 63 | 128) : (t[s++] = a >> 18 & 7 | 240,
                                                                                                    t[s++] = a >> 12 & 63 | 128,
                                                                                                    t[s++] = a >> 6 & 63 | 128)
                                        }
                                        t[s++] = 63 & a | 128
                                    } else
                                        t[s++] = a
                                }
                            }(e, this.bytes, this.pos),
                                this.pos += t
                    },
                        e.prototype.encodeObject = function(e, t) {
                        var i = this.extensionCodec.tryToEncode(e, this.context);
                        if (null != i)
                            this.encodeExtension(i);
                        else if (Array.isArray(e))
                            this.encodeArray(e, t);
                        else if (ArrayBuffer.isView(e))
                            this.encodeBinary(e);
                        else {
                            if ("object" != typeof e)
                                throw new Error("Unrecognized object: ".concat(Object.prototype.toString.apply(e)));
                            this.encodeMap(e, t)
                        }
                    },
                        e.prototype.encodeBinary = function(e) {
                        var t = e.byteLength;
                        if (t < 256)
                            this.writeU8(196),
                                this.writeU8(t);
                        else if (t < 65536)
                            this.writeU8(197),
                                this.writeU16(t);
                        else {
                            if (!(t < 4294967296))
                                throw new Error("Too large binary: ".concat(t));
                            this.writeU8(198),
                                this.writeU32(t)
                        }
                        var i = C(e);
                        this.writeU8a(i)
                    },
                        e.prototype.encodeArray = function(e, t) {
                        var i = e.length;
                        if (i < 16)
                            this.writeU8(144 + i);
                        else if (i < 65536)
                            this.writeU8(220),
                                this.writeU16(i);
                        else {
                            if (!(i < 4294967296))
                                throw new Error("Too large array: ".concat(i));
                            this.writeU8(221),
                                this.writeU32(i)
                        }
                        for (var n = 0, s = e; n < s.length; n++) {
                            var o = s[n];
                            this.doEncode(o, t + 1)
                        }
                    },
                        e.prototype.countWithoutUndefined = function(e, t) {
                        for (var i = 0, n = 0, s = t; n < s.length; n++)
                            void 0 !== e[s[n]] && i++;
                        return i
                    },
                        e.prototype.encodeMap = function(e, t) {
                        var i = Object.keys(e);
                        this.sortKeys && i.sort();
                        var n = this.ignoreUndefined ? this.countWithoutUndefined(e, i) : i.length;
                        if (n < 16)
                            this.writeU8(128 + n);
                        else if (n < 65536)
                            this.writeU8(222),
                                this.writeU16(n);
                        else {
                            if (!(n < 4294967296))
                                throw new Error("Too large map object: ".concat(n));
                            this.writeU8(223),
                                this.writeU32(n)
                        }
                        for (var s = 0, o = i; s < o.length; s++) {
                            var a = o[s],
                                r = e[a];
                            this.ignoreUndefined && void 0 === r || (this.encodeString(a),
                                                                     this.doEncode(r, t + 1))
                        }
                    },
                        e.prototype.encodeExtension = function(e) {
                        var t = e.data.length;
                        if (1 === t)
                            this.writeU8(212);
                        else if (2 === t)
                            this.writeU8(213);
                        else if (4 === t)
                            this.writeU8(214);
                        else if (8 === t)
                            this.writeU8(215);
                        else if (16 === t)
                            this.writeU8(216);
                        else if (t < 256)
                            this.writeU8(199),
                                this.writeU8(t);
                        else if (t < 65536)
                            this.writeU8(200),
                                this.writeU16(t);
                        else {
                            if (!(t < 4294967296))
                                throw new Error("Too large extension object: ".concat(t));
                            this.writeU8(201),
                                this.writeU32(t)
                        }
                        this.writeI8(e.type),
                            this.writeU8a(e.data)
                    },
                        e.prototype.writeU8 = function(e) {
                        this.ensureBufferSizeToWrite(1),
                            this.view.setUint8(this.pos, e),
                            this.pos++
                    },
                        e.prototype.writeU8a = function(e) {
                        var t = e.length;
                        this.ensureBufferSizeToWrite(t),
                            this.bytes.set(e, this.pos),
                            this.pos += t
                    },
                        e.prototype.writeI8 = function(e) {
                        this.ensureBufferSizeToWrite(1),
                            this.view.setInt8(this.pos, e),
                            this.pos++
                    },
                        e.prototype.writeU16 = function(e) {
                        this.ensureBufferSizeToWrite(2),
                            this.view.setUint16(this.pos, e),
                            this.pos += 2
                    },
                        e.prototype.writeI16 = function(e) {
                        this.ensureBufferSizeToWrite(2),
                            this.view.setInt16(this.pos, e),
                            this.pos += 2
                    },
                        e.prototype.writeU32 = function(e) {
                        this.ensureBufferSizeToWrite(4),
                            this.view.setUint32(this.pos, e),
                            this.pos += 4
                    },
                        e.prototype.writeI32 = function(e) {
                        this.ensureBufferSizeToWrite(4),
                            this.view.setInt32(this.pos, e),
                            this.pos += 4
                    },
                        e.prototype.writeF32 = function(e) {
                        this.ensureBufferSizeToWrite(4),
                            this.view.setFloat32(this.pos, e),
                            this.pos += 4
                    },
                        e.prototype.writeF64 = function(e) {
                        this.ensureBufferSizeToWrite(8),
                            this.view.setFloat64(this.pos, e),
                            this.pos += 8
                    },
                        e.prototype.writeU64 = function(e) {
                        this.ensureBufferSizeToWrite(8),
                            function(e, t, i) {
                            var n = i / 4294967296,
                                s = i;
                            e.setUint32(t, n),
                                e.setUint32(t + 4, s)
                        }(this.view, this.pos, e),
                            this.pos += 8
                    },
                        e.prototype.writeI64 = function(e) {
                        this.ensureBufferSizeToWrite(8),
                            r(this.view, this.pos, e),
                            this.pos += 8
                    },
                        e
                }(),
                    E = {};

                function O(e, t) {
                    return void 0 === t && (t = E),
                        new P(t.extensionCodec, t.context, t.maxDepth, t.initialBufferSize, t.sortKeys, t.forceFloat32, t.ignoreUndefined, t.forceIntegerToFloat).encodeSharedRef(e)
                }

                function B(e) {
                    return "".concat(e < 0 ? "-" : "", "0x").concat(Math.abs(e).toString(16).padStart(2, "0"))
                }
                var j = function() {
                    function e(e, t) {
                        void 0 === e && (e = 16),
                            void 0 === t && (t = 16),
                            this.maxKeyLength = e,
                            this.maxLengthPerKey = t,
                            this.hit = 0,
                            this.miss = 0,
                            this.caches = [];
                        for (var i = 0; i < this.maxKeyLength; i++)
                            this.caches.push([])
                    }
                    return e.prototype.canBeCached = function(e) {
                        return e > 0 && e <= this.maxKeyLength
                    },
                        e.prototype.find = function(e, t, i) {
                        e: for (var n = 0, s = this.caches[i - 1]; n < s.length; n++) {
                            for (var o = s[n], a = o.bytes, r = 0; r < i; r++)
                                if (a[r] !== e[t + r])
                                    continue e;
                            return o.str
                        }
                        return null
                    },
                        e.prototype.store = function(e, t) {
                        var i = this.caches[e.length - 1],
                            n = {
                                bytes: e,
                                str: t
                            };
                        i.length >= this.maxLengthPerKey ? i[Math.random() * i.length | 0] = n : i.push(n)
                    },
                        e.prototype.decode = function(e, t, i) {
                        var n = this.find(e, t, i);
                        if (null != n)
                            return this.hit++,
                                n;
                        this.miss++;
                        var s = p(e, t, i),
                            o = Uint8Array.prototype.slice.call(e, t, t + i);
                        return this.store(o, s),
                            s
                    },
                        e
                }(),
                    A = function(e, t) {
                        var i, n, s, o, a = {
                            label: 0,
                            sent: function() {
                                if (1 & s[0])
                                    throw s[1];
                                return s[1]
                            },
                            trys: [],
                            ops: []
                        };
                        return o = {
                            next: r(0),
                            throw: r(1),
                            return: r(2)
                        },
                            "function" == typeof Symbol && (o[Symbol.iterator] = function() {
                            return this
                        }),
                            o;

                        function r(o) {
                            return function(r) {
                                return function(o) {
                                    if (i)
                                        throw new TypeError("Generator is already executing.");
                                    for (; a;)
                                        try {
                                            if (i = 1,
                                                n && (s = 2 & o[0] ? n.return : o[0] ? n.throw || ((s = n.return) && s.call(n),
                                                                                                   0) : n.next) && !(s = s.call(n, o[1])).done)
                                                return s;
                                            switch (n = 0,
                                                    s && (o = [2 & o[0], s.value]),
                                                    o[0]) {
                                                case 0:
                                                case 1:
                                                    s = o;
                                                    break;
                                                case 4:
                                                    return a.label++, {
                                                        value: o[1],
                                                        done: !1
                                                    };
                                                case 5:
                                                    a.label++,
                                                        n = o[1],
                                                        o = [0];
                                                    continue;
                                                case 7:
                                                    o = a.ops.pop(),
                                                        a.trys.pop();
                                                    continue;
                                                default:
                                                    if (!(s = (s = a.trys).length > 0 && s[s.length - 1]) && (6 === o[0] || 2 === o[0])) {
                                                        a = 0;
                                                        continue
                                                    }
                                                    if (3 === o[0] && (!s || o[1] > s[0] && o[1] < s[3])) {
                                                        a.label = o[1];
                                                        break
                                                    }
                                                    if (6 === o[0] && a.label < s[1]) {
                                                        a.label = s[1],
                                                            s = o;
                                                        break
                                                    }
                                                    if (s && a.label < s[2]) {
                                                        a.label = s[2],
                                                            a.ops.push(o);
                                                        break
                                                    }
                                                    s[2] && a.ops.pop(),
                                                        a.trys.pop();
                                                    continue
                                            }
                                            o = t.call(e, a)
                                        } catch (e) {
                                            o = [6, e],
                                                n = 0
                                        } finally {
                                            i = s = 0
                                        }
                                    if (5 & o[0])
                                        throw o[1];
                                    return {
                                        value: o[0] ? o[1] : void 0,
                                        done: !0
                                    }
                                }([o, r])
                            }
                        }
                    },
                    D = function(e) {
                        if (!Symbol.asyncIterator)
                            throw new TypeError("Symbol.asyncIterator is not defined.");
                        var t, i = e[Symbol.asyncIterator];
                        return i ? i.call(e) : (e = "function" == typeof __values ? __values(e) : e[Symbol.iterator](),
                                                t = {},
                                                n("next"),
                                                n("throw"),
                                                n("return"),
                                                t[Symbol.asyncIterator] = function() {
                            return this
                        },
                                                t);

                        function n(i) {
                            t[i] = e[i] && function(t) {
                                return new Promise((function(n, s) {
                                    ! function(e, t, i, n) {
                                        Promise.resolve(n).then((function(t) {
                                            e({
                                                value: t,
                                                done: i
                                            })
                                        }), t)
                                    }(n, s, (t = e[i](t)).done, t.value)
                                }))
                            }
                        }
                    },
                    U = function(e) {
                        return this instanceof U ? (this.v = e,
                                                    this) : new U(e)
                    },
                    R = function(e, t, i) {
                        if (!Symbol.asyncIterator)
                            throw new TypeError("Symbol.asyncIterator is not defined.");
                        var n, s = i.apply(e, t || []),
                            o = [];
                        return n = {},
                            a("next"),
                            a("throw"),
                            a("return"),
                            n[Symbol.asyncIterator] = function() {
                            return this
                        },
                            n;

                        function a(e) {
                            s[e] && (n[e] = function(t) {
                                return new Promise((function(i, n) {
                                    o.push([e, t, i, n]) > 1 || r(e, t)
                                }))
                            })
                        }

                        function r(e, t) {
                            try {
                                ! function(e) {
                                    e.value instanceof U ? Promise.resolve(e.value.v).then(c, l) : h(o[0][2], e)
                                }(s[e](t))
                            } catch (e) {
                                h(o[0][3], e)
                            }
                        }

                        function c(e) {
                            r("next", e)
                        }

                        function l(e) {
                            r("throw", e)
                        }

                        function h(e, t) {
                            e(t),
                                o.shift(),
                                o.length && r(o[0][0], o[0][1])
                        }
                    },
                    L = function(e) {
                        var t = typeof e;
                        return "string" === t || "number" === t
                    },
                    z = new DataView(new ArrayBuffer(0)),
                    _ = new Uint8Array(z.buffer),
                    F = function() {
                        try {
                            z.getInt8(0)
                        } catch (e) {
                            return e.constructor
                        }
                        throw new Error("never reached")
                    }(),
                    H = new F("Insufficient data"),
                    V = new j,
                    q = function() {
                        function e(e, t, i, n, s, o, r, c) {
                            void 0 === e && (e = M.defaultCodec),
                                void 0 === t && (t = void 0),
                                void 0 === i && (i = a),
                                void 0 === n && (n = a),
                                void 0 === s && (s = a),
                                void 0 === o && (o = a),
                                void 0 === r && (r = a),
                                void 0 === c && (c = V),
                                this.extensionCodec = e,
                                this.context = t,
                                this.maxStrLength = i,
                                this.maxBinLength = n,
                                this.maxArrayLength = s,
                                this.maxMapLength = o,
                                this.maxExtLength = r,
                                this.keyDecoder = c,
                                this.totalPos = 0,
                                this.pos = 0,
                                this.view = z,
                                this.bytes = _,
                                this.headByte = -1,
                                this.stack = []
                        }
                        return e.prototype.reinitializeState = function() {
                            this.totalPos = 0,
                                this.headByte = -1,
                                this.stack.length = 0
                        },
                            e.prototype.setBuffer = function(e) {
                            this.bytes = C(e),
                                this.view = function(e) {
                                if (e instanceof ArrayBuffer)
                                    return new DataView(e);
                                var t = C(e);
                                return new DataView(t.buffer, t.byteOffset, t.byteLength)
                            }(this.bytes),
                                this.pos = 0
                        },
                            e.prototype.appendBuffer = function(e) {
                            if (-1 !== this.headByte || this.hasRemaining(1)) {
                                var t = this.bytes.subarray(this.pos),
                                    i = C(e),
                                    n = new Uint8Array(t.length + i.length);
                                n.set(t),
                                    n.set(i, t.length),
                                    this.setBuffer(n)
                            } else
                                this.setBuffer(e)
                        },
                            e.prototype.hasRemaining = function(e) {
                            return this.view.byteLength - this.pos >= e
                        },
                            e.prototype.createExtraByteError = function(e) {
                            var t = this.view,
                                i = this.pos;
                            return new RangeError("Extra ".concat(t.byteLength - i, " of ").concat(t.byteLength, " byte(s) found at buffer[").concat(e, "]"))
                        },
                            e.prototype.decode = function(e) {
                            this.reinitializeState(),
                                this.setBuffer(e);
                            var t = this.doDecodeSync();
                            if (this.hasRemaining(1))
                                throw this.createExtraByteError(this.pos);
                            return t
                        },
                            e.prototype.decodeMulti = function(e) {
                            return A(this, (function(t) {
                                switch (t.label) {
                                    case 0:
                                        this.reinitializeState(),
                                            this.setBuffer(e),
                                            t.label = 1;
                                    case 1:
                                        return this.hasRemaining(1) ? [4, this.doDecodeSync()] : [3, 3];
                                    case 2:
                                        return t.sent(),
                                            [3, 1];
                                    case 3:
                                        return [2]
                                }
                            }))
                        },
                            e.prototype.decodeAsync = function(e) {
                            var t, i, n, s;
                            return function(e, t, i, n) {
                                return new(i || (i = Promise))((function(s, o) {
                                    function a(e) {
                                        try {
                                            c(n.next(e))
                                        } catch (e) {
                                            o(e)
                                        }
                                    }

                                    function r(e) {
                                        try {
                                            c(n.throw(e))
                                        } catch (e) {
                                            o(e)
                                        }
                                    }

                                    function c(e) {
                                        e.done ? s(e.value) : function(e) {
                                            return e instanceof i ? e : new i((function(t) {
                                                t(e)
                                            }))
                                        }(e.value).then(a, r)
                                    }
                                    c((n = n.apply(e, t || [])).next())
                                }))
                            }(this, void 0, void 0, (function() {
                                var o, a, r, c, l, h, u, d;
                                return A(this, (function(f) {
                                    switch (f.label) {
                                        case 0:
                                            o = !1,
                                                f.label = 1;
                                        case 1:
                                            f.trys.push([1, 6, 7, 12]),
                                                t = D(e),
                                                f.label = 2;
                                        case 2:
                                            return [4, t.next()];
                                        case 3:
                                            if ((i = f.sent()).done)
                                                return [3, 5];
                                            if (r = i.value,
                                                o)
                                                throw this.createExtraByteError(this.totalPos);
                                            this.appendBuffer(r);
                                            try {
                                                a = this.doDecodeSync(),
                                                    o = !0
                                            } catch (e) {
                                                if (!(e instanceof F))
                                                    throw e
                                            }
                                            this.totalPos += this.pos,
                                                f.label = 4;
                                        case 4:
                                            return [3, 2];
                                        case 5:
                                            return [3, 12];
                                        case 6:
                                            return c = f.sent(),
                                                n = {
                                                error: c
                                            },
                                                [3, 12];
                                        case 7:
                                            return f.trys.push([7, , 10, 11]),
                                                i && !i.done && (s = t.return) ? [4, s.call(t)] : [3, 9];
                                        case 8:
                                            f.sent(),
                                                f.label = 9;
                                        case 9:
                                            return [3, 11];
                                        case 10:
                                            if (n)
                                                throw n.error;
                                            return [7];
                                        case 11:
                                            return [7];
                                        case 12:
                                            if (o) {
                                                if (this.hasRemaining(1))
                                                    throw this.createExtraByteError(this.totalPos);
                                                return [2, a]
                                            }
                                            throw h = (l = this).headByte,
                                                u = l.pos,
                                                d = l.totalPos,
                                                new RangeError("Insufficient data in parsing ".concat(B(h), " at ").concat(d, " (").concat(u, " in the current buffer)"))
                                    }
                                }))
                            }))
                        },
                            e.prototype.decodeArrayStream = function(e) {
                            return this.decodeMultiAsync(e, !0)
                        },
                            e.prototype.decodeStream = function(e) {
                            return this.decodeMultiAsync(e, !1)
                        },
                            e.prototype.decodeMultiAsync = function(e, t) {
                            return R(this, arguments, (function() {
                                var i, n, s, o, a, r, c, l, h;
                                return A(this, (function(u) {
                                    switch (u.label) {
                                        case 0:
                                            i = t,
                                                n = -1,
                                                u.label = 1;
                                        case 1:
                                            u.trys.push([1, 13, 14, 19]),
                                                s = D(e),
                                                u.label = 2;
                                        case 2:
                                            return [4, U(s.next())];
                                        case 3:
                                            if ((o = u.sent()).done)
                                                return [3, 12];
                                            if (a = o.value,
                                                t && 0 === n)
                                                throw this.createExtraByteError(this.totalPos);
                                            this.appendBuffer(a),
                                                i && (n = this.readArraySize(),
                                                      i = !1,
                                                      this.complete()),
                                                u.label = 4;
                                        case 4:
                                            u.trys.push([4, 9, , 10]),
                                                u.label = 5;
                                        case 5:
                                            return [4, U(this.doDecodeSync())];
                                        case 6:
                                            return [4, u.sent()];
                                        case 7:
                                            return u.sent(),
                                                0 == --n ? [3, 8] : [3, 5];
                                        case 8:
                                            return [3, 10];
                                        case 9:
                                            if (!((r = u.sent()) instanceof F))
                                                throw r;
                                            return [3, 10];
                                        case 10:
                                            this.totalPos += this.pos,
                                                u.label = 11;
                                        case 11:
                                            return [3, 2];
                                        case 12:
                                            return [3, 19];
                                        case 13:
                                            return c = u.sent(),
                                                l = {
                                                error: c
                                            },
                                                [3, 19];
                                        case 14:
                                            return u.trys.push([14, , 17, 18]),
                                                o && !o.done && (h = s.return) ? [4, U(h.call(s))] : [3, 16];
                                        case 15:
                                            u.sent(),
                                                u.label = 16;
                                        case 16:
                                            return [3, 18];
                                        case 17:
                                            if (l)
                                                throw l.error;
                                            return [7];
                                        case 18:
                                            return [7];
                                        case 19:
                                            return [2]
                                    }
                                }))
                            }))
                        },
                            e.prototype.doDecodeSync = function() {
                            e: for (;;) {
                                var e = this.readHeadByte(),
                                    t = void 0;
                                if (e >= 224)
                                    t = e - 256;
                                else if (e < 192)
                                    if (e < 128)
                                        t = e;
                                    else if (e < 144) {
                                        if (0 != (n = e - 128)) {
                                            this.pushMapState(n),
                                                this.complete();
                                            continue e
                                        }
                                        t = {}
                                    } else if (e < 160) {
                                        if (0 != (n = e - 144)) {
                                            this.pushArrayState(n),
                                                this.complete();
                                            continue e
                                        }
                                        t = []
                                    } else {
                                        var i = e - 160;
                                        t = this.decodeUtf8String(i, 0)
                                    } else if (192 === e)
                                        t = null;
                                else if (194 === e)
                                    t = !1;
                                else if (195 === e)
                                    t = !0;
                                else if (202 === e)
                                    t = this.readF32();
                                else if (203 === e)
                                    t = this.readF64();
                                else if (204 === e)
                                    t = this.readU8();
                                else if (205 === e)
                                    t = this.readU16();
                                else if (206 === e)
                                    t = this.readU32();
                                else if (207 === e)
                                    t = this.readU64();
                                else if (208 === e)
                                    t = this.readI8();
                                else if (209 === e)
                                    t = this.readI16();
                                else if (210 === e)
                                    t = this.readI32();
                                else if (211 === e)
                                    t = this.readI64();
                                else if (217 === e)
                                    i = this.lookU8(),
                                        t = this.decodeUtf8String(i, 1);
                                else if (218 === e)
                                    i = this.lookU16(),
                                        t = this.decodeUtf8String(i, 2);
                                else if (219 === e)
                                    i = this.lookU32(),
                                        t = this.decodeUtf8String(i, 4);
                                else if (220 === e) {
                                    if (0 !== (n = this.readU16())) {
                                        this.pushArrayState(n),
                                            this.complete();
                                        continue e
                                    }
                                    t = []
                                } else if (221 === e) {
                                    if (0 !== (n = this.readU32())) {
                                        this.pushArrayState(n),
                                            this.complete();
                                        continue e
                                    }
                                    t = []
                                } else if (222 === e) {
                                    if (0 !== (n = this.readU16())) {
                                        this.pushMapState(n),
                                            this.complete();
                                        continue e
                                    }
                                    t = {}
                                } else if (223 === e) {
                                    if (0 !== (n = this.readU32())) {
                                        this.pushMapState(n),
                                            this.complete();
                                        continue e
                                    }
                                    t = {}
                                } else if (196 === e) {
                                    var n = this.lookU8();
                                    t = this.decodeBinary(n, 1)
                                } else if (197 === e)
                                    n = this.lookU16(),
                                        t = this.decodeBinary(n, 2);
                                else if (198 === e)
                                    n = this.lookU32(),
                                        t = this.decodeBinary(n, 4);
                                else if (212 === e)
                                    t = this.decodeExtension(1, 0);
                                else if (213 === e)
                                    t = this.decodeExtension(2, 0);
                                else if (214 === e)
                                    t = this.decodeExtension(4, 0);
                                else if (215 === e)
                                    t = this.decodeExtension(8, 0);
                                else if (216 === e)
                                    t = this.decodeExtension(16, 0);
                                else if (199 === e)
                                    n = this.lookU8(),
                                        t = this.decodeExtension(n, 1);
                                else if (200 === e)
                                    n = this.lookU16(),
                                        t = this.decodeExtension(n, 2);
                                else {
                                    if (201 !== e)
                                        throw new w("Unrecognized type byte: ".concat(B(e)));
                                    n = this.lookU32(),
                                        t = this.decodeExtension(n, 4)
                                }
                                this.complete();
                                for (var s = this.stack; s.length > 0;) {
                                    var o = s[s.length - 1];
                                    if (0 === o.type) {
                                        if (o.array[o.position] = t,
                                            o.position++,
                                            o.position !== o.size)
                                            continue e;
                                        s.pop(),
                                            t = o.array
                                    } else {
                                        if (1 === o.type) {
                                            if (!L(t))
                                                throw new w("The type of key must be string or number but " + typeof t);
                                            if ("__proto__" === t)
                                                throw new w("The key __proto__ is not allowed");
                                            o.key = t,
                                                o.type = 2;
                                            continue e
                                        }
                                        if (o.map[o.key] = t,
                                            o.readCount++,
                                            o.readCount !== o.size) {
                                            o.key = null,
                                                o.type = 1;
                                            continue e
                                        }
                                        s.pop(),
                                            t = o.map
                                    }
                                }
                                return t
                            }
                        },
                            e.prototype.readHeadByte = function() {
                            return -1 === this.headByte && (this.headByte = this.readU8()),
                                this.headByte
                        },
                            e.prototype.complete = function() {
                            this.headByte = -1
                        },
                            e.prototype.readArraySize = function() {
                            var e = this.readHeadByte();
                            switch (e) {
                                case 220:
                                    return this.readU16();
                                case 221:
                                    return this.readU32();
                                default:
                                    if (e < 160)
                                        return e - 144;
                                    throw new w("Unrecognized array type byte: ".concat(B(e)))
                            }
                        },
                            e.prototype.pushMapState = function(e) {
                            if (e > this.maxMapLength)
                                throw new w("Max length exceeded: map length (".concat(e, ") > maxMapLengthLength (").concat(this.maxMapLength, ")"));
                            this.stack.push({
                                type: 1,
                                size: e,
                                key: null,
                                readCount: 0,
                                map: {}
                            })
                        },
                            e.prototype.pushArrayState = function(e) {
                            if (e > this.maxArrayLength)
                                throw new w("Max length exceeded: array length (".concat(e, ") > maxArrayLength (").concat(this.maxArrayLength, ")"));
                            this.stack.push({
                                type: 0,
                                size: e,
                                array: new Array(e),
                                position: 0
                            })
                        },
                            e.prototype.decodeUtf8String = function(e, t) {
                            var i;
                            if (e > this.maxStrLength)
                                throw new w("Max length exceeded: UTF-8 byte length (".concat(e, ") > maxStrLength (").concat(this.maxStrLength, ")"));
                            if (this.bytes.byteLength < this.pos + t + e)
                                throw H;
                            var n, s = this.pos + t;
                            return n = this.stateIsMapKey() && (null === (i = this.keyDecoder) || void 0 === i ? void 0 : i.canBeCached(e)) ? this.keyDecoder.decode(this.bytes, s, e) : e > m ? function(e, t, i) {
                                var n = e.subarray(t, t + i);
                                return g.decode(n)
                            }(this.bytes, s, e) : p(this.bytes, s, e),
                                this.pos += t + e,
                                n
                        },
                            e.prototype.stateIsMapKey = function() {
                            return this.stack.length > 0 && 1 === this.stack[this.stack.length - 1].type
                        },
                            e.prototype.decodeBinary = function(e, t) {
                            if (e > this.maxBinLength)
                                throw new w("Max length exceeded: bin length (".concat(e, ") > maxBinLength (").concat(this.maxBinLength, ")"));
                            if (!this.hasRemaining(e + t))
                                throw H;
                            var i = this.pos + t,
                                n = this.bytes.subarray(i, i + e);
                            return this.pos += t + e,
                                n
                        },
                            e.prototype.decodeExtension = function(e, t) {
                            if (e > this.maxExtLength)
                                throw new w("Max length exceeded: ext length (".concat(e, ") > maxExtLength (").concat(this.maxExtLength, ")"));
                            var i = this.view.getInt8(this.pos + t),
                                n = this.decodeBinary(e, t + 1);
                            return this.extensionCodec.decode(n, i, this.context)
                        },
                            e.prototype.lookU8 = function() {
                            return this.view.getUint8(this.pos)
                        },
                            e.prototype.lookU16 = function() {
                            return this.view.getUint16(this.pos)
                        },
                            e.prototype.lookU32 = function() {
                            return this.view.getUint32(this.pos)
                        },
                            e.prototype.readU8 = function() {
                            var e = this.view.getUint8(this.pos);
                            return this.pos++,
                                e
                        },
                            e.prototype.readI8 = function() {
                            var e = this.view.getInt8(this.pos);
                            return this.pos++,
                                e
                        },
                            e.prototype.readU16 = function() {
                            var e = this.view.getUint16(this.pos);
                            return this.pos += 2,
                                e
                        },
                            e.prototype.readI16 = function() {
                            var e = this.view.getInt16(this.pos);
                            return this.pos += 2,
                                e
                        },
                            e.prototype.readU32 = function() {
                            var e = this.view.getUint32(this.pos);
                            return this.pos += 4,
                                e
                        },
                            e.prototype.readI32 = function() {
                            var e = this.view.getInt32(this.pos);
                            return this.pos += 4,
                                e
                        },
                            e.prototype.readU64 = function() {
                            var e = function(e, t) {
                                return 4294967296 * e.getUint32(t) + e.getUint32(t + 4)
                            }(this.view, this.pos);
                            return this.pos += 8,
                                e
                        },
                            e.prototype.readI64 = function() {
                            var e = c(this.view, this.pos);
                            return this.pos += 8,
                                e
                        },
                            e.prototype.readF32 = function() {
                            var e = this.view.getFloat32(this.pos);
                            return this.pos += 4,
                                e
                        },
                            e.prototype.readF64 = function() {
                            var e = this.view.getFloat64(this.pos);
                            return this.pos += 8,
                                e
                        },
                            e
                    }(),
                    W = {};

                function X(e, t) {
                    return void 0 === t && (t = W),
                        new q(t.extensionCodec, t.context, t.maxStrLength, t.maxBinLength, t.maxArrayLength, t.maxMapLength, t.maxExtLength).decode(e)
                }

                function G(e, t) {
                    return void 0 === t && (t = W),
                        new q(t.extensionCodec, t.context, t.maxStrLength, t.maxBinLength, t.maxArrayLength, t.maxMapLength, t.maxExtLength).decodeMulti(e)
                }
                var N = function(e, t) {
                    var i, n, s, o, a = {
                        label: 0,
                        sent: function() {
                            if (1 & s[0])
                                throw s[1];
                            return s[1]
                        },
                        trys: [],
                        ops: []
                    };
                    return o = {
                        next: r(0),
                        throw: r(1),
                        return: r(2)
                    },
                        "function" == typeof Symbol && (o[Symbol.iterator] = function() {
                        return this
                    }),
                        o;

                    function r(o) {
                        return function(r) {
                            return function(o) {
                                if (i)
                                    throw new TypeError("Generator is already executing.");
                                for (; a;)
                                    try {
                                        if (i = 1,
                                            n && (s = 2 & o[0] ? n.return : o[0] ? n.throw || ((s = n.return) && s.call(n),
                                                                                               0) : n.next) && !(s = s.call(n, o[1])).done)
                                            return s;
                                        switch (n = 0,
                                                s && (o = [2 & o[0], s.value]),
                                                o[0]) {
                                            case 0:
                                            case 1:
                                                s = o;
                                                break;
                                            case 4:
                                                return a.label++, {
                                                    value: o[1],
                                                    done: !1
                                                };
                                            case 5:
                                                a.label++,
                                                    n = o[1],
                                                    o = [0];
                                                continue;
                                            case 7:
                                                o = a.ops.pop(),
                                                    a.trys.pop();
                                                continue;
                                            default:
                                                if (!(s = (s = a.trys).length > 0 && s[s.length - 1]) && (6 === o[0] || 2 === o[0])) {
                                                    a = 0;
                                                    continue
                                                }
                                                if (3 === o[0] && (!s || o[1] > s[0] && o[1] < s[3])) {
                                                    a.label = o[1];
                                                    break
                                                }
                                                if (6 === o[0] && a.label < s[1]) {
                                                    a.label = s[1],
                                                        s = o;
                                                    break
                                                }
                                                if (s && a.label < s[2]) {
                                                    a.label = s[2],
                                                        a.ops.push(o);
                                                    break
                                                }
                                                s[2] && a.ops.pop(),
                                                    a.trys.pop();
                                                continue
                                        }
                                        o = t.call(e, a)
                                    } catch (e) {
                                        o = [6, e],
                                            n = 0
                                    } finally {
                                        i = s = 0
                                    }
                                if (5 & o[0])
                                    throw o[1];
                                return {
                                    value: o[0] ? o[1] : void 0,
                                    done: !0
                                }
                            }([o, r])
                        }
                    }
                },
                    Y = function(e) {
                        return this instanceof Y ? (this.v = e,
                                                    this) : new Y(e)
                    },
                    K = function(e, t, i) {
                        if (!Symbol.asyncIterator)
                            throw new TypeError("Symbol.asyncIterator is not defined.");
                        var n, s = i.apply(e, t || []),
                            o = [];
                        return n = {},
                            a("next"),
                            a("throw"),
                            a("return"),
                            n[Symbol.asyncIterator] = function() {
                            return this
                        },
                            n;

                        function a(e) {
                            s[e] && (n[e] = function(t) {
                                return new Promise((function(i, n) {
                                    o.push([e, t, i, n]) > 1 || r(e, t)
                                }))
                            })
                        }

                        function r(e, t) {
                            try {
                                ! function(e) {
                                    e.value instanceof Y ? Promise.resolve(e.value.v).then(c, l) : h(o[0][2], e)
                                }(s[e](t))
                            } catch (e) {
                                h(o[0][3], e)
                            }
                        }

                        function c(e) {
                            r("next", e)
                        }

                        function l(e) {
                            r("throw", e)
                        }

                        function h(e, t) {
                            e(t),
                                o.shift(),
                                o.length && r(o[0][0], o[0][1])
                        }
                    };

                function J(e) {
                    return function(e) {
                        return null != e[Symbol.asyncIterator]
                    }(e) ? e : function(e) {
                        return K(this, arguments, (function() {
                            var t, i, n, s;
                            return N(this, (function(o) {
                                switch (o.label) {
                                    case 0:
                                        t = e.getReader(),
                                            o.label = 1;
                                    case 1:
                                        o.trys.push([1, , 9, 10]),
                                            o.label = 2;
                                    case 2:
                                        return [4, Y(t.read())];
                                    case 3:
                                        return i = o.sent(),
                                            n = i.done,
                                            s = i.value,
                                            n ? [4, Y(void 0)] : [3, 5];
                                    case 4:
                                        return [2, o.sent()];
                                    case 5:
                                        return function(e) {
                                            if (null == e)
                                                throw new Error("Assertion Failure: value must not be null nor undefined")
                                        }(s),
                                            [4, Y(s)];
                                    case 6:
                                        return [4, o.sent()];
                                    case 7:
                                        return o.sent(),
                                            [3, 2];
                                    case 8:
                                        return [3, 10];
                                    case 9:
                                        return t.releaseLock(),
                                            [7];
                                    case 10:
                                        return [2]
                                }
                            }))
                        }))
                    }(e)
                }

                function Q(e, t) {
                    return void 0 === t && (t = W),
                        function(e, t, i, n) {
                        return new(i || (i = Promise))((function(s, o) {
                            function a(e) {
                                try {
                                    c(n.next(e))
                                } catch (e) {
                                    o(e)
                                }
                            }

                            function r(e) {
                                try {
                                    c(n.throw(e))
                                } catch (e) {
                                    o(e)
                                }
                            }

                            function c(e) {
                                e.done ? s(e.value) : function(e) {
                                    return e instanceof i ? e : new i((function(t) {
                                        t(e)
                                    }))
                                }(e.value).then(a, r)
                            }
                            c((n = n.apply(e, t || [])).next())
                        }))
                    }(this, void 0, void 0, (function() {
                        var i;
                        return function(e, t) {
                            var i, n, s, o, a = {
                                label: 0,
                                sent: function() {
                                    if (1 & s[0])
                                        throw s[1];
                                    return s[1]
                                },
                                trys: [],
                                ops: []
                            };
                            return o = {
                                next: r(0),
                                throw: r(1),
                                return: r(2)
                            },
                                "function" == typeof Symbol && (o[Symbol.iterator] = function() {
                                return this
                            }),
                                o;

                            function r(o) {
                                return function(r) {
                                    return function(o) {
                                        if (i)
                                            throw new TypeError("Generator is already executing.");
                                        for (; a;)
                                            try {
                                                if (i = 1,
                                                    n && (s = 2 & o[0] ? n.return : o[0] ? n.throw || ((s = n.return) && s.call(n),
                                                                                                       0) : n.next) && !(s = s.call(n, o[1])).done)
                                                    return s;
                                                switch (n = 0,
                                                        s && (o = [2 & o[0], s.value]),
                                                        o[0]) {
                                                    case 0:
                                                    case 1:
                                                        s = o;
                                                        break;
                                                    case 4:
                                                        return a.label++, {
                                                            value: o[1],
                                                            done: !1
                                                        };
                                                    case 5:
                                                        a.label++,
                                                            n = o[1],
                                                            o = [0];
                                                        continue;
                                                    case 7:
                                                        o = a.ops.pop(),
                                                            a.trys.pop();
                                                        continue;
                                                    default:
                                                        if (!(s = (s = a.trys).length > 0 && s[s.length - 1]) && (6 === o[0] || 2 === o[0])) {
                                                            a = 0;
                                                            continue
                                                        }
                                                        if (3 === o[0] && (!s || o[1] > s[0] && o[1] < s[3])) {
                                                            a.label = o[1];
                                                            break
                                                        }
                                                        if (6 === o[0] && a.label < s[1]) {
                                                            a.label = s[1],
                                                                s = o;
                                                            break
                                                        }
                                                        if (s && a.label < s[2]) {
                                                            a.label = s[2],
                                                                a.ops.push(o);
                                                            break
                                                        }
                                                        s[2] && a.ops.pop(),
                                                            a.trys.pop();
                                                        continue
                                                }
                                                o = t.call(e, a)
                                            } catch (e) {
                                                o = [6, e],
                                                    n = 0
                                            } finally {
                                                i = s = 0
                                            }
                                        if (5 & o[0])
                                            throw o[1];
                                        return {
                                            value: o[0] ? o[1] : void 0,
                                            done: !0
                                        }
                                    }([o, r])
                                }
                            }
                        }(this, (function(n) {
                            return i = J(e),
                                [2, new q(t.extensionCodec, t.context, t.maxStrLength, t.maxBinLength, t.maxArrayLength, t.maxMapLength, t.maxExtLength).decodeAsync(i)]
                        }))
                    }))
                }

                function $(e, t) {
                    void 0 === t && (t = W);
                    var i = J(e);
                    return new q(t.extensionCodec, t.context, t.maxStrLength, t.maxBinLength, t.maxArrayLength, t.maxMapLength, t.maxExtLength).decodeArrayStream(i)
                }

                function Z(e, t) {
                    void 0 === t && (t = W);
                    var i = J(e);
                    return new q(t.extensionCodec, t.context, t.maxStrLength, t.maxBinLength, t.maxArrayLength, t.maxMapLength, t.maxExtLength).decodeStream(i)
                }

                function ee(e, t) {
                    return void 0 === t && (t = W),
                        Z(e, t)
                }
                i.d(t, "encode", (function() {
                    return O
                }));
                i.d(t, "decode", (function() {
                    return X
                }));
                i.d(t, "decodeMulti", (function() {
                    return G
                }));
                i.d(t, "decodeAsync", (function() {
                    return Q
                }));
                i.d(t, "decodeArrayStream", (function() {
                    return $
                }));
                i.d(t, "decodeMultiStream", (function() {
                    return Z
                }));
                i.d(t, "decodeStream", (function() {
                    return ee
                }));
                i.d(t, "Decoder", (function() {
                    return q
                }));
                i.d(t, "DecodeError", (function() {
                    return w
                }));
                i.d(t, "DataViewIndexOutOfBoundsError", (function() {
                    return F
                }));
                i.d(t, "Encoder", (function() {
                    return P
                }));
                i.d(t, "ExtensionCodec", (function() {
                    return M
                }));
                i.d(t, "ExtData", (function() {
                    return y
                }));
                i.d(t, "EXT_TIMESTAMP", (function() {
                    return -1
                }));
                i.d(t, "encodeDateToTimeSpec", (function() {
                    return b
                }));
                i.d(t, "encodeTimeSpecToTimestamp", (function() {
                    return v
                }));
                i.d(t, "decodeTimestampToTimeSpec", (function() {
                    return S
                }));
                i.d(t, "encodeTimestampExtension", (function() {
                    return x
                }));
                i.d(t, "decodeTimestampExtension", (function() {
                    return I
                }));
            }, function(e, t, n) { //38
                e.exports.perSecond = {
                    count: 0,
                    max: 90,
                };
                e.exports.perMinute = {
                    count: 0,
                    max: 54e2,
                };
                setInterval(() => e.exports.perSecond.count = 0, 1e3);
                setInterval(() => e.exports.perMinute.count = 0, 1e3 * 60);
            }, function(e, t, n) { //game features
                e.exports.pathFinder = {
                    toggle: false,
                    goTo: {
                        x: 0,
                        y: 0,
                    },
                };
                e.exports.autoPlacer = {
                    count: 0,
                    toggle: true,
                };
                e.exports.autoMill = {
                    toggle: false,
                    x: 0,
                    y: 0,
                };
                e.exports.autoGrind = {
                    toggle: false,
                };
                e.exports.camFollow = {
                    toggle: false,
                    target: null,
                };
                e.exports.shadowMode = false;
                e.exports.showTrapRadar = false;
            }, function(e, t, n) { //40
                e.exports.bots = [];
                e.exports.bot = [];
                e.exports.websocketCodes == ``;
            }, function(e, t, n) { //41
                e.exports = {
                    autoOneTick: {
                        image: new Image("https://icones.pro/wp-content/uploads/2021/08/symbole-cible-rose.png"),
                        target: null,
                    },
                    xd: {
                        image: new Image("https://icones.pro/wp-content/uploads/2021/08/symbole-cible-noir.png"),
                        target: null,
                    },
                    autoInstakill: {
                        image: new Image("https://cdn.discordapp.com/attachments/1082264720339374158/1149675044637786122/inevcrosshair.png?ex=66bb4a52&is=66b9f8d2&hm=04e73346eaafb0e3708fce779c5bd07c23690189af6e2266bf174bf73005d14e&"),
                        target: null,
                    },
                };
            }];
    ! function(e) {
        var t = {};

        function i(n) {
            if (t[n])
                return t[n].exports;
            var s = t[n] = {
                i: n,
                l: !1,
                exports: {}
            };
            return e[n].call(s.exports, s, s.exports, i),
                s.l = !0,
                s.exports
        }
        i.m = e,
            i.c = t,
            i.d = function(e, t, n) {
            i.o(e, t) || Object.defineProperty(e, t, {
                enumerable: !0,
                get: n
            })
        },
            i.r = function(e) {
            "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
                value: "Module"
            }),
                Object.defineProperty(e, "__esModule", {
                value: !0
            })
        },
            i.t = function(e, t) {
            if (1 & t && (e = i(e)),
                8 & t)
                return e;
            if (4 & t && "object" == typeof e && e && e.__esModule)
                return e;
            var n = Object.create(null);
            if (i.r(n),
                Object.defineProperty(n, "default", {
                enumerable: !0,
                value: e
            }),
                2 & t && "string" != typeof e)
                for (var s in e)
                    i.d(n, s, function(t) {
                        return e[t]
                    }
                        .bind(null, s));
            return n
        },
            i.n = function(e) {
            var t = e && e.__esModule ? function() {
                return e.default
            } :
            function() {
                return e
            };
            return i.d(t, "a", t),
                t
        },
            i.o = function(e, t) {
            return Object.prototype.hasOwnProperty.call(e, t)
        },
            i.p = "",
            i(i.s = 2)
    }(webpackModules);
    document.getElementById("leaderboardButton").remove();
});
