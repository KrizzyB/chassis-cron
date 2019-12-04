const cron = require("node-schedule");

module.exports.startSchedule = function(args) {
    global.Cron = findCrons();
    let jobs = Object.keys(Cron);

    function startCron(c) {
        let settings = getConfig(jobs[c]);

        if (settings && settings.enabled) {
            Cron[jobs[c]].cron = cron.scheduleJob(settings.frequency, function() {
                exports.run(jobs[c], args);
            });
            Log.info("Cron job \"" + jobs[c] + "\" started at frequency \"" + settings.frequency + "\".");
        } else {
            jobs.splice(c, 1);
            c--;
        }

        if (c+1 < jobs.length) {
            startCron(c+1);
        }
    }

    startCron(0);
};

module.exports.run = function(job, args) {
    new Thread(Cron[job].path, "job", args).fork();
};

module.exports.job = function(args) {
    if (!Cron) {
        global.Cron = findCrons();
    }

    Log.info("Running cron job: " + args.job);

    let Job = require(Cron[args.job].file).job;
    Job(args.args);
};

function findCrons() {
    let Cron = {};

    function readDirectory(dir, cronDir) {
        let items = FileSystem.readSync(dir);
        function checkItem(i) {
            if (FileSystem.isDir(dir + items[i])) {
                if (items[i] === "cron") {
                    readDirectory(dir + items[i] + "/", true);  //flag this dir as to be read
                } else {    //check this directory
                    readDirectory(dir + items[i] + "/", cronDir);
                }
            } else {
                if (cronDir) {
                    let name = items[i].substring(0, items[i].lastIndexOf("."));
                    Cron[name] = require(appRoot + dir + items[i]);
                }
            }

            if (i+1 < items.length) {
                checkItem(i+1);
            }
        }

        if (items.length) {
            checkItem(0);
        }
    }

    readDirectory("./app/", false); //start checking directories from application root
    return Cron;
}

function getConfig(job) {
    let settings = {
        enabled: false,
        frequency: "* * * * *",
    };

    if (config && config[job]) {    //if app config exists
        settings = {
            enabled: config[job].enabled,
            frequency: config[job].frequency,
        }
    } else if (Cron[job] && Cron[job].frequency) {   //if internal cron config exists
        settings = {
            enabled: Cron[job].enabled,
            frequency: Cron[job].frequency,
        }
    }

    return settings;
}