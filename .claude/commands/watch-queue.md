Check `social/dispatch-queue.json` for pending tasks and execute them.

## Step 1 — Read the queue

```
node -e "const d=JSON.parse(require('fs').readFileSync('social/dispatch-queue.json','utf8')); console.log(JSON.stringify(d));"
```

## Step 2 — If queue is empty

Print nothing. The loop will check again on the next interval.

## Step 3 — If queue has items

For each item in `queue`, in order:

### 3a — Claim the item (remove it immediately to prevent double-execution)

```
node -e "
const fs=require('fs');
const f='social/dispatch-queue.json';
const d=JSON.parse(fs.readFileSync(f,'utf8'));
const item=d.queue.shift();
fs.writeFileSync(f,JSON.stringify(d,null,2));
console.log(item ? JSON.stringify(item) : 'empty');
"
```

If output is `empty`, stop here.

### 3b — Identify the item type

- **`type: 'blog-refresh'`** (research → brief → draft → QA → Google Doc): Execute `/blog-refresh-run [taskId] [slug] [track]`
- **`type: 'blog-publish'`** (translate → CMS publish → IndexNow → done): Execute `/blog-publish-run [taskId] [slug]`
- **CE item** (has `taskId` + `stage` fields, no `type`): Execute `/run-ce-stage [taskId] [stage]`
- **Legacy ops item** (has only `id` field): Execute `/run-task [id]`

Print: `[watch-queue] Dispatching: [taskId or id] — type: [type or stage or ops]`

### 3c — Execute

Run the matching command above with its arguments.

### 3d — Repeat

After execution completes, check if any items remain in the queue. If yes, repeat from Step 3a.
