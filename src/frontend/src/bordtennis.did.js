export const idlFactory = ({ IDL }) => {
  const Player = IDL.Record({
    id: IDL.Nat,
    name: IDL.Text,
    emoji: IDL.Text,
    photo: IDL.Opt(IDL.Text),
    active: IDL.Bool,
    createdAt: IDL.Int,
  });
  const Result = IDL.Record({ playerId: IDL.Nat, placement: IDL.Nat, points: IDL.Nat });
  const Game = IDL.Record({
    id: IDL.Nat,
    playedAt: IDL.Int,
    note: IDL.Text,
    results: IDL.Vec(Result),
    recordedBy: IDL.Principal,
  });
  const Standing = IDL.Record({
    playerId: IDL.Nat,
    name: IDL.Text,
    emoji: IDL.Text,
    photo: IDL.Opt(IDL.Text),
    played: IDL.Nat,
    totalPoints: IDL.Nat,
    avgPoints: IDL.Float64,
    wins: IDL.Nat,
    winPct: IDL.Float64,
    rank: IDL.Nat,
  });
  return IDL.Service({
    addPlayer: IDL.Func([IDL.Text, IDL.Text], [Player], []),
    setPhoto: IDL.Func([IDL.Nat, IDL.Text], [IDL.Bool], []),
    setActive: IDL.Func([IDL.Nat, IDL.Bool], [IDL.Bool], []),
    listPlayers: IDL.Func([], [IDL.Vec(Player)], ["query"]),
    recordGame: IDL.Func([IDL.Vec(IDL.Nat), IDL.Text], [IDL.Opt(Game)], []),
    deleteGame: IDL.Func([IDL.Nat], [IDL.Bool], []),
    listGames: IDL.Func([], [IDL.Vec(Game)], ["query"]),
    standings: IDL.Func([], [IDL.Vec(Standing)], ["query"]),
    health: IDL.Func([], [IDL.Text], ["query"]),
    whoami: IDL.Func([], [IDL.Principal], ["query"]),
  });
};
