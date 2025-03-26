import  { configuration, FindParams }   from './';;
import { BPMNServer, Logger } from './';
import { EventEmitter } from 'events';

const logger = new Logger({ toConsole: true});

let name = 'find';
const server = new BPMNServer(configuration, logger, { cron: false });
/**
 * saved views:
 * 		pending instances , showing all pending items %type% , sort by any instance field
 * 		completed instances, showing all items , %type% , sort by 
 * 		pending tasks	, sort by any task field
 * 		completed tasks , sort by any task field
 * 
 * 	Questions:
 * 		1.	Instance Conditions
 * 		2.	Task Conditions
 * 		3.	Sort field
 */
main();

async function main() {

	const project1={ id: 1, data: 1, name: 1, _id:1,startedAt:1,status:1,  // columns to return
		items: {        
			$filter: {  // filter items to only include UserTask types    
			  input: "$items",
			  as: "item",
			  cond: {
			   $eq: ["$$item.type", "bpmn:UserTask"] // filter to include only UserTask items
			  }
			}
	}};

	const project2={ id: 1, data: 1, name: 1, _id:1,startedAt:1,status:1,  // columns to return
		items: {        
			$filter: {  // filter items to only include UserTask types    
			  input: "$items",
			  as: "item",
			  cond: {
			   	$and:[
						{$eq: ["$$item.type", "bpmn:UserTask"]},
						{$eq: ["$$item.status", "wait"]}
					]}
			  }
			}
	};
	const project3={ id: 1, data: 1, name: 1, _id:1,startedAt:1,status:1, "items.dueDate":1, "items.type":1,"items.name":1,"items.status":1	};

	await findAggregation({ name: 'Buy Used Car' ,"items.status": 'wait' },{"items.dueDate":1},project3,true);	// has any item in wait status
	console.log('--------------------------------------');

	await findAggregation({ name: 'Buy Used Car' ,"status": 'end' ,"items.name": 'Drive'},{"startedAt":1},project3,true);			// instances with end status
}
async function findAggregation(filter,sort:Record<string,1|-1>={_id:-1},projection,printItems=false) {
    // benchmark findInstances
        console.time('find-instances call');
    
    let insts=await server.dataStore.findInstances(filter, 'summary');
	if (insts.length==0)
		return;
    let lastIns=insts[insts.length-1];
    console.log('findInstances:',insts.length,lastIns.startedAt,lastIns.data.caseId);

    console.timeEnd('find-instances call');

    // benchmark find)

    // works perfect
    let nextCursor = null;
    let param:FindParams = {
        getTotalCount: true, // get the total count of records
        limit: 50, // limit to 10 records per page
        filter: filter, // filter by process name
        sort: sort,   // sort by _id to get the earliest first
        projection: projection
    };

    for(let i=0;i<100;i++) {
            if (i>0)
                param.after=nextCursor;
    
            console.time('find-aggregation call');
            let res=await server.dataStore.find(param);

			if (res.data.length===0)
				return;
    
            if (i===0)
			{
                console.log('findAggregation    total', res.totalCount,'total pages', Math.ceil(res.totalCount/param.limit));
				console.log(JSON.stringify(param,null,2));
				console.log('-----------------------------------------');
			}

            param.getTotalCount=false; // do not get the total count again
            if (res.error) {
                console.log('error',res.error);
                return;
            }
            else if(!res.data)
                return;
            let first=res.data?res.data[0]:null;
            let last=res.data?res.data[res.data.length-1]:null;
    
            nextCursor=res.nextCursor;
            
            console.timeEnd('find-aggregation call');
    
            console.log('findAggregation    page:',i+1,'length:',res.data.length,res.nextCursor);
			//console.log('		',first._id,first.startedAt,first.data.caseId,first.items.length);//.data.length, res.data[0] );
			//console.log('		',last._id,last.startedAt,last.data.caseId,last.items.length);//.data.length, res.data[0] );

			if (printItems)
			{
				
				res.data.forEach(inst=>{
					let item=inst.items;
					console.log('		',inst._id,inst.startedAt,inst.data.caseId,item.name,item.status,'due Date:',item.dueDate);
				});
			}
			else {
				res.data.forEach(inst=>{
					console.log('		',inst._id,inst.startedAt,inst.data.caseId,inst.items.length);
				});

			}

			//if (i==0) 
				{
				//console.log('Sample Instance Items:');
				//first.items.forEach(item=>{
				//	console.log(`	item:# ${item.seq} 	${item.name}	status:${item.status}	due ${item.dueDate}`);
				//})
			}

            if(res.data.length<param.limit)
                break;

    }
}

