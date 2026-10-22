import Map "mo:base/HashMap";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Time "mo:base/Time";
import Option "mo:base/Option";
import Buffer "mo:base/Buffer";
import Float "mo:base/Float";
import Blob "mo:base/Blob";
import Principal "mo:base/Principal";

persistent actor Bordtennis {

  // ---------- Types ----------

  public type PlayerId = Nat;
  public type GameId = Nat;

  public type Player = {
    id : PlayerId;
    name : Text;
    emoji : Text;          // fun avatar fallback
    photo : ?Text;         // data-url or asset path
    active : Bool;
    createdAt : Int;
  };

  public type Result = {
    playerId : PlayerId;
    placement : Nat;       // 1 = winner
    points : Nat;          // points awarded for this game
  };

  public type Game = {
    id : GameId;
    playedAt : Int;
    note : Text;
    results : [Result];
    recordedBy : Principal;
  };

  // Wire-only extension: old stored Game/Result records keep their Nat schema.
  // pointsHalf is an exact count of half-points; legacy points remains the floor.
  public type ResultView = { playerId : PlayerId; placement : Nat; points : Nat; pointsHalf : ?Nat };
  public type GameView = { id : GameId; playedAt : Int; note : Text; results : [ResultView]; recordedBy : Principal };

  public type Standing = {
    playerId : PlayerId;
    name : Text;
    emoji : Text;
    photo : ?Text;
    played : Nat;
    totalPoints : Nat;
    totalPointsHalf : ?Nat;
    avgPoints : Float;
    wins : Nat;
    winPct : Float;
    rank : Nat;
  };

  // ---------- State ----------

  var nextPlayerId : Nat = 0;
  var nextGameId : Nat = 0;
  // Minimum antall spilte runder for å komme på den offisielle rankingen.
  // Justerbar av innloggede brukere. Eksisterende data røres ikke av dette.
  var minGames : Nat = 3;
  var playerEntries : [(PlayerId, Player)] = [];
  var gameEntries : [(GameId, Game)] = [];
  // Only placements with a fractional +0.5. Existing games have no entry.
  var fractionalEntries : [(GameId, [Nat])] = [];
  transient var fractional = Map.HashMap<GameId, [Nat]>(16, Nat.equal, func(n : Nat) : Nat32 { Nat32.fromNat(n % 4294967295) });

  transient var players = Map.HashMap<PlayerId, Player>(16, Nat.equal, func(n : Nat) : Nat32 { Nat32.fromNat(n % 4294967295) });
  transient var games = Map.HashMap<GameId, Game>(64, Nat.equal, func(n : Nat) : Nat32 { Nat32.fromNat(n % 4294967295) });

  system func preupgrade() {
    playerEntries := Iter.toArray(players.entries());
    gameEntries := Iter.toArray(games.entries());
    fractionalEntries := Iter.toArray(fractional.entries());
  };

  system func postupgrade() {
    for ((k, v) in playerEntries.vals()) { players.put(k, v) };
    for ((k, v) in gameEntries.vals()) { games.put(k, v) };
    for ((k, v) in fractionalEntries.vals()) { fractional.put(k, v) };
    fractionalEntries := [];
    playerEntries := [];
    gameEntries := [];
  };

  // ---------- Scoring ----------
  // Exact half-point units. 2..9 players retain their previously agreed scores.
  // From 10 players, split the lowest gaps into half-points first; top = 8,7.
  transient let HALF_TABLE : [[Nat]] = [
    [16,0], [16,8,0], [16,12,6,0], [16,12,8,4,0],
    [16,12,8,4,2,0], [16,12,8,6,4,2,0], [16,12,10,8,6,4,2,0],
    [16,14,12,10,8,6,4,2,0],
    [16,14,12,10,8,6,4,2,1,0],
    [16,14,12,10,8,6,4,3,2,1,0],
    [16,14,12,10,8,6,5,4,3,2,1,0],
    [16,14,12,10,8,7,6,5,4,3,2,1,0],
  ];

  func halfPointsFor(placement : Nat, participants : Nat) : Nat {
    if (placement == 0 or placement > participants or participants < 2) { return 0 };
    let idx = if (participants > 13) 11 else participants - 2;
    let row = HALF_TABLE[idx];
    if (placement <= row.size()) { row[placement - 1] } else { 0 }
  };
  func pointsFor(placement : Nat, participants : Nat) : Nat {
    halfPointsFor(placement, participants) / 2
  };
  func setFractions(g : Game) {
    let positions = Array.map<Result, Nat>(Array.filter<Result>(g.results, func(r) {
      halfPointsFor(r.placement, g.results.size()) % 2 == 1
    }), func(r) { r.placement });
    if (positions.size() == 0) { ignore fractional.remove(g.id) }
    else { fractional.put(g.id, positions) };
  };
  func resultHalf(gid : GameId, r : Result) : Nat {
    let positions = Option.get(fractional.get(gid), []);
    r.points * 2 + (if (Option.isSome(Array.find<Nat>(positions, func(p) { p == r.placement }))) 1 else 0)
  };
  func view(g : Game) : GameView {
    { id = g.id; playedAt = g.playedAt; note = g.note; recordedBy = g.recordedBy;
      results = Array.map<Result, ResultView>(g.results, func(r) {
        { playerId = r.playerId; placement = r.placement; points = r.points; pointsHalf = ?resultHalf(g.id, r) }
      }) }
  };

  // ---------- Players ----------

  public shared ({ caller }) func addPlayer(name : Text, emoji : Text) : async Player {
    ignore caller;
    let id = nextPlayerId;
    nextPlayerId += 1;
    let p : Player = {
      id;
      name;
      emoji;
      photo = null;
      active = true;
      createdAt = Time.now();
    };
    players.put(id, p);
    p
  };

  public func setPhoto(id : PlayerId, photo : Text) : async Bool {
    switch (players.get(id)) {
      case null { false };
      case (?p) {
        players.put(id, { p with photo = ?photo });
        true
      };
    }
  };

  public func setActive(id : PlayerId, active : Bool) : async Bool {
    switch (players.get(id)) {
      case null { false };
      case (?p) { players.put(id, { p with active }); true };
    }
  };

  public query func listPlayers() : async [Player] {
    Iter.toArray(players.vals())
  };

  // ---------- Games ----------
  // ranking = playerIds in finishing order (index 0 = winner)
  public shared ({ caller }) func recordGame(ranking : [PlayerId], note : Text) : async ?GameView {
    if (Principal.isAnonymous(caller)) { return null };
    let n = ranking.size();
    if (n < 2) { return null };
    let buf = Buffer.Buffer<Result>(n);
    var i = 0;
    while (i < n) {
      let pid = ranking[i];
      if (Option.isNull(players.get(pid))) { return null };
      buf.add({ playerId = pid; placement = i + 1; points = pointsFor(i + 1, n) });
      i += 1;
    };
    let id = nextGameId;
    nextGameId += 1;
    let g : Game = { id; playedAt = Time.now(); note; results = Buffer.toArray(buf); recordedBy = caller };
    games.put(id, g);
    setFractions(g);
    ?view(g)
  };

  // Import av historikk fra Excel-arket (eksplisitt dato).
  public shared ({ caller }) func importGame(ranking : [PlayerId], note : Text, playedAt : Int) : async ?GameView {
    if (Principal.isAnonymous(caller)) { return null };
    let n = ranking.size();
    if (n < 2) { return null };
    let buf = Buffer.Buffer<Result>(n);
    var i = 0;
    while (i < n) {
      let pid = ranking[i];
      if (Option.isNull(players.get(pid))) { return null };
      buf.add({ playerId = pid; placement = i + 1; points = pointsFor(i + 1, n) });
      i += 1;
    };
    let id = nextGameId;
    nextGameId += 1;
    let g : Game = { id; playedAt; note; results = Buffer.toArray(buf); recordedBy = caller };
    games.put(id, g);
    setFractions(g);
    ?view(g)
  };

  public func deleteGame(id : GameId) : async Bool {
    ignore fractional.remove(id);
    switch (games.remove(id)) { case null { false }; case (?_) { true } }
  };

  public query func listGames() : async [GameView] {
    Array.map<Game, GameView>(Iter.toArray(games.vals()), view)
  };

  // Controller-only maintenance: compare the complete expected records before
  // changing anything. No await between validation and writes: all-or-nothing.
  // Rescoring preserves IDs, dates, players, placements, notes and recordedBy.
  public shared ({ caller }) func correctGames(expected : [GameView], remove : ?GameView) : async { #ok; #err : Text } {
    if (not Principal.isController(caller)) { return #err("Controller required") };
    let seen = Map.HashMap<GameId, Bool>(expected.size(), Nat.equal, func(n : Nat) : Nat32 { Nat32.fromNat(n % 4294967295) });
    for (g in expected.vals()) {
      if (Option.isSome(seen.get(g.id))) { return #err("Duplicate game ID") };
      seen.put(g.id, true);
      switch (games.get(g.id)) {
        case (?current) { if (view(current) != g) { return #err("Game changed; refresh expected data") } };
        case null { return #err("Game not found") };
      };
    };
    switch (remove) {
      case (?g) {
        if (Option.isSome(seen.get(g.id))) { return #err("Cannot rescore and delete the same game") };
        switch (games.get(g.id)) {
          case (?current) { if (view(current) != g) { return #err("Deletion target changed; refresh expected data") } };
          case null { return #err("Deletion target not found") };
        };
      };
      case null {};
    };
    for (g in expected.vals()) {
      let results = Array.map<ResultView, Result>(g.results, func(r) {
        { playerId = r.playerId; placement = r.placement; points = pointsFor(r.placement, g.results.size()) }
      });
      let updated : Game = { id = g.id; playedAt = g.playedAt; note = g.note; recordedBy = g.recordedBy; results };
      games.put(g.id, updated);
      setFractions(updated);
    };
    switch (remove) { case (?g) { ignore games.remove(g.id); ignore fractional.remove(g.id) }; case null {} };
    #ok
  };

  // ---------- Standings ----------

  public query func standings() : async [Standing] {
    let acc = Map.HashMap<PlayerId, (Nat, Nat, Nat)>(16, Nat.equal, func(n : Nat) : Nat32 { Nat32.fromNat(n % 4294967295) });
    for (g in games.vals()) {
      for (r in g.results.vals()) {
        let (played, pts, wins) = Option.get(acc.get(r.playerId), (0, 0, 0));
        acc.put(r.playerId, (played + 1, pts + resultHalf(g.id, r), wins + (if (r.placement == 1) 1 else 0)));
      };
    };
    let buf = Buffer.Buffer<Standing>(16);
    for (p in players.vals()) {
      let (played, pts, wins) = Option.get(acc.get(p.id), (0, 0, 0));
      let avg = if (played == 0) 0.0 else Float.fromInt(pts) / 2.0 / Float.fromInt(played);
      let wpct = if (played == 0) 0.0 else Float.fromInt(wins) / Float.fromInt(played);
      buf.add({
        playerId = p.id;
        name = p.name;
        emoji = p.emoji;
        photo = p.photo;
        played;
        totalPoints = pts / 2;
        totalPointsHalf = ?pts;
        avgPoints = avg;
        wins;
        winPct = wpct;
        rank = 0;
      });
    };
    let arr = Array.sort(Buffer.toArray(buf), func(a : Standing, b : Standing) : { #less; #equal; #greater } {
      if (a.avgPoints > b.avgPoints) { #less }
      else if (a.avgPoints < b.avgPoints) { #greater }
      else if (a.wins > b.wins) { #less }
      else if (a.wins < b.wins) { #greater }
      else { #equal }
    });
    Array.tabulate<Standing>(arr.size(), func(i) { { arr[i] with rank = i + 1 } })
  };

  // ---------- Innstillinger ----------

  public query func getMinGames() : async Nat { minGames };

  public shared ({ caller }) func setMinGames(n : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (n < 1 or n > 50) { return false };
    minGames := n;
    true
  };

  public query func health() : async Text { "bordtennis-ok" };

  public shared query ({ caller }) func whoami() : async Principal { caller };
}
