const $ = id => document.getElementById(id);
const key = g => `${g.category}:${g.game}`;

async function loadData() {
    const version = Date.now();

    const getJson = async path => {
        const response = await fetch(path + '?v=' + version);

        if (!response.ok) {
            throw Error('Could not load ' + path);
        }

        return response.json();
    };

    const [schedule, results, config] = await Promise.all([
        getJson('data/schedule.json'),
        getJson('data/results.json'),
        getJson('data/config.json')
    ]);

    return {
        schedule,
        results,
        config
    };
}

function esc(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]
    );
}

function gd(game, results) {
    return Object.assign(
        {
            status: 'scheduled',
            score1: null,
            score2: null,
            pitchers: [],
            batters: [],
            mvp: {}
        },
        results.games[key(game)] || {}
    );
}

function badge(status) {
    const labels = {
        scheduled: 'Scheduled',
        live: 'In progress',
        completed: 'Completed',
        cancelled: 'Cancelled'
    };

    return `
        <span class="status ${status}">
            ${labels[status] || status}
        </span>
    `;
}

function groupComplete(category, group, schedule, results) {
    const qualificationGames = schedule.filter(game =>
        game.category === category &&
        game.group === group &&
        game.phase === 'QUALIFICATION'
    );

    return (
        qualificationGames.length > 0 &&
        qualificationGames.every(
            game => gd(game, results).status === 'completed'
        )
    );
}

function table(category, group, schedule, results, config) {
    const teams =
        config.categories[category].groups[group] || [];

    const statistics = {};

    teams.forEach(team => {
        statistics[team] = {
            team,
            g: 0,
            w: 0,
            l: 0,
            t: 0,
            rf: 0,
            ra: 0,
            diff: 0,
            pct: 0,
            tqb:
                results.tqb?.[
                    `${category}:${group}:${team}`
                ] ?? null
        };
    });

    const completedGames = schedule
        .filter(game =>
            game.category === category &&
            game.group === group &&
            game.phase === 'QUALIFICATION'
        )
        .map(game => [
            game,
            gd(game, results)
        ])
        .filter(([, result]) =>
            result.status === 'completed' &&
            Number.isInteger(result.score1) &&
            Number.isInteger(result.score2)
        );

    completedGames.forEach(([game, result]) => {
        const team1 = statistics[game.team1];
        const team2 = statistics[game.team2];

        if (!team1 || !team2) {
            return;
        }

        team1.g++;
        team2.g++;

        team1.rf += result.score1;
        team1.ra += result.score2;

        team2.rf += result.score2;
        team2.ra += result.score1;

        if (result.score1 > result.score2) {
            team1.w++;
            team2.l++;
        } else if (result.score2 > result.score1) {
            team2.w++;
            team1.l++;
        } else {
            team1.t++;
            team2.t++;
        }
    });

    Object.values(statistics).forEach(team => {
        team.diff = team.rf - team.ra;

        team.pct = team.g
            ? (team.w + team.t * 0.5) / team.g
            : 0;
    });

    const headToHead = (teamA, teamB) => {
        const directGame = completedGames.find(
            ([game]) =>
                (
                    game.team1 === teamA.team &&
                    game.team2 === teamB.team
                ) ||
                (
                    game.team1 === teamB.team &&
                    game.team2 === teamA.team
                )
        );

        if (!directGame) {
            return 0;
        }

        const [game, result] = directGame;

        if (result.score1 === result.score2) {
            return 0;
        }

        const winner =
            result.score1 > result.score2
                ? game.team1
                : game.team2;

        return winner === teamA.team ? -1 : 1;
    };

    return Object.values(statistics).sort(
        (teamA, teamB) =>
            teamB.pct - teamA.pct ||

            headToHead(teamA, teamB) ||

            (
                (teamB.tqb ?? -Infinity) -
                (teamA.tqb ?? -Infinity)
            ) ||

            teamB.diff - teamA.diff ||

            teamB.rf - teamA.rf ||

            teamA.team.localeCompare(teamB.team)
    );
}

function outcome(
    category,
    gameNumber,
    schedule,
    results,
    winnerRequested
) {
    const game = schedule.find(
        item =>
            item.category === category &&
            item.game === String(gameNumber)
    );

    const result =
        game && gd(game, results);

    if (
        !game ||
        result.status !== 'completed' ||
        !Number.isInteger(result.score1) ||
        !Number.isInteger(result.score2) ||
        result.score1 === result.score2
    ) {
        return null;
    }

    const firstTeamWon =
        result.score1 > result.score2;

    if (winnerRequested) {
        return firstTeamWon
            ? game.team1
            : game.team2;
    }

    return firstTeamWon
        ? game.team2
        : game.team1;
}

function effective(schedule, results, config) {
    const rankMaps = {
        U10: {
            '11': ['A', 2, 'A', 3],
            '12': ['A', 0, 'A', 1]
        },

        U12: {
            '31': ['A', 5, 'B', 5],
            '32': ['A', 3, 'B', 3],
            '33': ['A', 1, 'B', 1],
            '34': ['A', 4, 'B', 4],
            '35': ['A', 2, 'B', 2],
            '36': ['A', 0, 'B', 0]
        },

        U15: {
            '21': ['A', 3, 'B', 2],
            '22': ['A', 2, 'B', 3],
            '23': ['A', 1, 'B', 0],
            '24': ['A', 0, 'B', 1],
            '25': ['A', 4, 'B', 4]
        },

        U18: {
            '21': ['A', 3, 'B', 2],
            '22': ['A', 2, 'B', 3],
            '23': ['A', 1, 'B', 0],
            '24': ['A', 0, 'B', 1],
            '25': ['A', 4, 'B', 4]
        }
    };

    const effectiveSchedule =
        schedule.map(game => {
            const mapping =
                rankMaps[game.category]?.[game.game];

            if (!mapping) {
                return { ...game };
            }

            const [
                groupA,
                indexA,
                groupB,
                indexB
            ] = mapping;

            const groupsAreComplete =
                groupComplete(
                    game.category,
                    groupA,
                    schedule,
                    results
                ) &&
                groupComplete(
                    game.category,
                    groupB,
                    schedule,
                    results
                );

            if (!groupsAreComplete) {
                return { ...game };
            }

            const standingsA = table(
                game.category,
                groupA,
                schedule,
                results,
                config
            );

            const standingsB = table(
                game.category,
                groupB,
                schedule,
                results,
                config
            );

            return {
                ...game,

                team1:
                    standingsA[indexA]?.team ||
                    game.team1,

                team2:
                    standingsB[indexB]?.team ||
                    game.team2
            };
        });

    const resultMaps = {
        U15: {
            '26': [21, false, 22, false],
            '27': [21, true, 22, true],
            '28': [23, false, 24, false],
            '29': [23, true, 24, true]
        },

        U18: {
            '26': [21, false, 22, false],
            '27': [21, true, 22, true],
            '28': [23, false, 24, false],
            '29': [23, true, 24, true]
        }
    };

    return effectiveSchedule.map(game => {
        const mapping =
            resultMaps[game.category]?.[game.game];

        if (!mapping) {
            return game;
        }

        const [
            game1,
            winner1,
            game2,
            winner2
        ] = mapping;

        return {
            ...game,

            team1:
                outcome(
                    game.category,
                    game1,
                    effectiveSchedule,
                    results,
                    winner1
                ) || game.team1,

            team2:
                outcome(
                    game.category,
                    game2,
                    effectiveSchedule,
                    results,
                    winner2
                ) || game.team2
        };
    });
}

function pct(value) {
    return value
        .toFixed(3)
        .replace(/^0/, '');
}