export namespace main {
	
	export class MediaInfo {
	    path: string;
	    hasVideo: boolean;
	    hasAudio: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MediaInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.hasVideo = source["hasVideo"];
	        this.hasAudio = source["hasAudio"];
	    }
	}

}

