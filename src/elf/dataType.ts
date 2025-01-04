export enum DataType {
	None,
	
	// map dispos
	Npc,
	Item,
	Mobj,
	Aobj,
	Bshape,
	Effect,
	Gobj,

	DataEffect,
	ResourceGobj,
	
	// registries
	CharacterNpc,
	CharacterMobj,
	CharacterParty,
	CharacterItem,
	CharacterAobj,
	
	MapId,
	ItemList,
	
	// this is the end of the actual file types and start of sub types
	TypeAmount,
	ListItem,
}
