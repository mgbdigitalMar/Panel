export const MAX_GLASS_SHAPES = 12;

/* Independent WebGL2 liquid glass: edge refraction, color pickup, and shape merging. MIT. */
const vertex = `#version 300 es
in vec2 a_position;
void main(){gl_Position=vec4(a_position,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
out vec4 color;
uniform vec2 u_size;
uniform vec2 u_bufferSize;
uniform vec2 u_sourceSize;
uniform sampler2D u_source;
uniform float u_backdropDim;
uniform int u_count;
uniform vec4 u_shapes[12];
uniform float u_radii[12];
uniform vec2 u_rotation[12]; // cosine and sine in screen coordinates
uniform float u_refraction,u_bezel,u_magnify,u_dispersion,u_edge,u_sizeScale;
uniform float u_blur,u_frost,u_vibrancy,u_brightness,u_dim,u_appearance;
uniform float u_pickup,u_tintAmount,u_specular,u_rimWidth,u_lightAngle,u_shadow,u_merge;
uniform float u_press[12];
uniform float u_surface[12],u_motion[12];
uniform sampler2D u_outlines;
uniform int u_outlineCount[${MAX_GLASS_SHAPES}];
uniform vec2 u_stretch[12],u_contact[12];
uniform vec4 u_switchBase,u_segmentBase; // center, width, height
uniform float u_switchOn;
uniform vec4 u_themeBase; // center, width, height
uniform int u_themeShape;
uniform float u_themeLight; // rim light angle for the theme thumb
uniform float u_themeTint; // 0 dark .. 1 light, drives the resting hue
uniform vec3 u_themeGlow; // current arc color, bled into the thumb's rim
uniform vec4 u_sliderTrack; // left, center Y, width, height
uniform float u_clearControls,u_presetOptics;
uniform float u_sliderFill; // filled track end X
uniform vec3 u_tint;
uniform bool u_surfaceOnly;
uniform bool u_exactBackdrop;
uniform bool u_controlLayer;

vec4 compositeGlass(vec3 base,vec3 glass,float mask){
  return u_surfaceOnly&&!u_exactBackdrop&&!u_controlLayer?vec4(glass,mask):vec4(mix(base,glass,mask),1.);
}

float roundedBox(vec2 p, vec2 halfSize, float radius){
  vec2 q=abs(p)-halfSize+radius;
  return length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
}
vec2 coverUV(vec2 p){
  vec2 fitted=vec2(u_sourceSize.x/u_sourceSize.y*u_size.y,u_size.y);
  if(fitted.x<u_size.x)fitted=vec2(u_size.x,u_sourceSize.y/u_sourceSize.x*u_size.x);
  return clamp((p-u_size*.5)/fitted+.5,vec2(.001),vec2(.999));
}
float trackMask(vec2 p, float from, float to, float radius, float feather){
  vec2 q=p-vec2(clamp(p.x,from,to),u_sliderTrack.y);
  return 1.-smoothstep(radius-feather,radius+feather,length(q));
}
float baseMask(vec2 p,vec4 box,float feather){
  if(box.w<=0.)return 0.;
  float d=roundedBox(p-box.xy,box.zw*.5,box.w*.5);
  return 1.-smoothstep(-feather,feather,d);
}
vec3 sampleSoft(vec2 p,float blur){
  float feather=max(.5,blur*1.45);
  vec3 base=textureLod(u_source,coverUV(p),log2(1.+blur*3.6)).rgb;
  base=mix(base,vec3(8.,10.,9.)/255.,u_backdropDim);
  float switchMask=baseMask(p,u_switchBase,feather);
  vec3 switchColor=mix(vec3(.45,.46,.43),vec3(.90,.33,.21),u_switchOn);
  base=mix(base,switchColor,switchMask*mix(.82,1.,u_switchOn));
  base=mix(base,vec3(.10,.13,.12),baseMask(p,u_segmentBase,feather)*.69);
  if(u_themeBase.w>0.){
    vec2 q=p-u_themeBase.xy;
    float depth=-roundedBox(q,u_themeBase.zw*.5,u_themeBase.w*.36);
    float coverage=smoothstep(-feather,feather,depth);
    vec3 track=mix(vec3(.049,.051,.063),vec3(.88,.87,.84),u_themeTint);
    float upper=1.-smoothstep(-.45,.45,q.y/u_themeBase.w);
    float wall=exp(-max(depth,0.)/4.8);
    track*=1.-wall*(.14+.37*upper);
    track+=mix(.07,.26,u_themeTint)*wall*(1.-upper);
    base=mix(base,track,coverage);
  }
  if(u_sliderTrack.w<=0.)return base;
  float r=u_sliderTrack.w*.5;
  float start=u_sliderTrack.x+r;
  float end=u_sliderTrack.x+u_sliderTrack.z-r;
  float rail=trackMask(p,start,end,r,feather);
  if(rail<=0.)return base;
  float fill=trackMask(p,start,clamp(u_sliderFill,start,end),r,feather);
  vec3 inactive=mix(base,vec3(.35,.39,.38),rail*.43);
  return mix(inactive,mix(base,vec3(.97,.96,.93),.96),fill);
}
vec3 sampleAt(vec2 p){return sampleSoft(p,0.);}
vec3 liquidLens(vec2 p,vec2 normal,float field,float press,bool clear,float chromatic){
  // Sample the backdrop through a curved rim around a clear center.
  float depth=max(-field,0.);
  float strength=clear?mix(.85,1.,press):press;
  float t=clamp(depth/mix(7.,clear?19.:14.,strength),0.,1.);
  float bend=sin(t*3.141593)*mix(2.,clear?10.8:6.4,strength)*(u_refraction/18.);
  vec2 at=p+normal*bend*(clear?1.:-1.);
  float softness=mix(1.55,1.65,press);
  vec3 lens=sampleAt(at)*.48;
  lens+=(sampleAt(at+vec2(softness,0.))+sampleAt(at-vec2(softness,0.))+
         sampleAt(at+vec2(0.,softness))+sampleAt(at-vec2(0.,softness)))*.10;
  vec2 diagonal=vec2(softness*.7);
  lens+=(sampleAt(at+diagonal)+sampleAt(at-diagonal)+
         sampleAt(at+vec2(diagonal.x,-diagonal.y))+sampleAt(at+vec2(-diagonal.x,diagonal.y)))*.03;
  if(chromatic>.001){
    // Offset the sampled rays, so an even backdrop stays neutral.
    vec2 split=normal*sin(t*3.141593)*chromatic;
    vec3 centerRay=sampleSoft(at,.65);
    lens.r+=(sampleSoft(at-split,.65).r-centerRay.r)*.62;
    lens.b+=(sampleSoft(at+split,.65).b-centerRay.b)*.62;
  }
  lens=mix(lens,vec3(.985,.99,.98),clear?mix(.045,.075,press):mix(.90,.08,press));
  vec2 light=vec2(cos(radians(u_lightAngle)),sin(radians(u_lightAngle)));
  float facing=dot(normal,light);
  float direction=.32+.68*pow(abs(facing),1.6);
  float rim=1.-smoothstep(0.,max(u_rimWidth,.5)*2.5,depth);
  float sheen=rim*mix(.73+.27*direction,direction,strength)*u_specular*mix(1.35,1.08,press);
  return mix(lens,vec3(1.),clamp(sheen,0.,1.));
}
float outlineDistance(vec2 q,vec2 size,int row,int count){
  vec2 a=(texelFetch(u_outlines,ivec2(count-1,row),0).xy-.5)*size;
  float nearest=1e12;
  bool inside=false;
  for(int j=0;j<64;j++){
    if(j>=count)break;
    vec2 b=(texelFetch(u_outlines,ivec2(j,row),0).xy-.5)*size;
    vec2 edge=b-a, ray=q-a;
    vec2 delta=ray-edge*clamp(dot(ray,edge)/max(dot(edge,edge),.00001),0.,1.);
    nearest=min(nearest,dot(delta,delta));
    if((a.y>q.y)!=(b.y>q.y)){
      if(q.x<a.x+(q.y-a.y)*edge.x/edge.y)inside=!inside;
    }
    a=b;
  }
  return sqrt(nearest)*(inside?-1.:1.);
}
vec2 localGlassVector(vec2 q,int i){
  vec2 angle=u_rotation[i];
  return vec2(angle.x*q.x+angle.y*q.y,angle.x*q.y-angle.y*q.x);
}
float shapeDistance(vec2 p,int i){
  vec4 s=u_shapes[i];
  vec2 q=p-s.xy;
  float stretch=length(u_stretch[i]);
  if(stretch>.001){
    vec2 direction=u_stretch[i]/stretch;
    float halfSpan=dot(abs(localGlassVector(direction,i)),s.zw*.5);
    float axis=dot(q,direction);
    // Deform the trailing half more than the leading face.
    float back=1.-smoothstep(-halfSpan*.6,halfSpan*.55,axis);
    float extension=stretch*mix(.13,.87,back);
    q-=direction*axis*extension/(halfSpan+extension);
    // The rear narrows as it stretches, instead of elongating a rigid capsule.
    vec2 across=vec2(-direction.y,direction.x);
    q+=across*dot(q,across)*back*min(.42,stretch/max(36.,halfSpan*2.)*.7);
  }
  q=localGlassVector(q,i);
  vec2 halfSize=s.zw*.5;
  if(u_outlineCount[i]>2){
    float beyond=max(abs(q.x)-halfSize.x,abs(q.y)-halfSize.y);
    if(beyond>max(64.,u_merge*3.))return beyond;
    return outlineDistance(q,s.zw,i,u_outlineCount[i]);
  }
  if(u_surface[i]==4. && abs(halfSize.x-halfSize.y)>.001){
    // Scale the ellipse's implicit field by its local normal for a stable rim width.
    vec2 unit=q/halfSize;
    float distance=length(unit);
    if(distance<.0001)return -min(halfSize.x,halfSize.y);
    return (distance-1.)/length(unit/(distance*halfSize));
  }
  return roundedBox(q,halfSize,u_radii[i]);
}
vec4 fieldAt(vec2 p,out vec4 dynamics,out vec2 contact,out float sliderPress,out float movement,out float junction,out vec2 dome,out float menuWeight){
  vec4 field=vec4(1e5,0.,0.,0.);
  dynamics=vec4(0.,0.,1.,0.);
  contact=vec2(0.);
  sliderPress=0.;
  movement=0.;
  junction=0.;
  dome=vec2(0.);
  menuWeight=0.;
  for(int i=0;i<${MAX_GLASS_SHAPES};i++){
    if(i>=u_count)break;
    if(i==u_themeShape)continue;
    vec4 shape=u_shapes[i];
    float candidate=shapeDistance(p,i);
    if(u_surface[i]==5.){
      if(candidate>1.3)continue;
      dynamics=vec4(shape.xy,1.,0.);
      contact=vec2(0.);
      junction=0.;
      movement=0.;
      dome=vec2(0.);
      menuWeight=1.;
      return vec4(candidate,0.,0.,0.);
    }
    float press=u_press[i];
    float scale=u_sizeScale>0.?clamp(min(shape.z,shape.w)/140.,.8,1.55):1.;
    vec4 motion=vec4(shape.xy,scale,press);
    vec3 material=vec3(float(u_surface[i]==1.),float(u_surface[i]==2.),float(u_surface[i]==3.));
    if(u_surface[i]==1.)sliderPress=press;
    float lens=float(u_surface[i]==4.);
    vec2 droplet=vec2(lens,lens*min(shape.z,shape.w)*.5);
    float k=max(u_merge,0.)*(1.+.65*max(dynamics.w,press));
    if(k<=.001){
      if(candidate<field.x){field=vec4(candidate,material);dynamics=motion;contact=u_contact[i];movement=u_motion[i];dome=droplet;}
      continue;
    }
    float h=clamp(.5+.5*(field.x-candidate)/k,0.,1.);
    float blend=clamp(.5+.5*(field.x-candidate)/(k*1.65),0.,1.);
    // Outside the merge band, use the exact same field as an isolated shape.
    if(blend>=1.){
      field=vec4(candidate,material);dynamics=motion;contact=u_contact[i];
      movement=u_motion[i];dome=droplet;junction=0.;
      continue;
    }
    if(blend<=0.)continue;
    field.yzw=mix(field.yzw,material,blend);
    // The smooth union also describes how much liquid was drawn into the neck.
    float thickness=k*h*(1.-h);
    junction=mix(junction,0.,h)+thickness;
    field.x=mix(field.x,candidate,h)-thickness;
    dynamics=mix(dynamics,motion,blend);
    contact=mix(contact,u_contact[i],blend);
    movement=mix(movement,u_motion[i],blend);
    dome=mix(dome,droplet,blend);
  }
  return field;
}
vec3 presetLens(vec2 p,vec2 centre,vec2 n,float field,float scale,float press,vec2 contact,float contactRadius,out float rim,out float shine,out vec2 at){
  float edge=1.-smoothstep(0.,max(u_bezel*scale*.55*(1.+press*.25),1.),max(-field,0.));
  float profile=u_edge>0.?edge*(1.-edge*edge):edge*edge;
  vec2 bend=n*u_refraction*scale*.75*(1.+press*.45)*profile;
  float zoom=max(u_magnify+press*.16,1.);
  vec2 centerPull=(p-centre)*(1.-1./zoom);
  at=p-bend-centerPull;
  vec2 split=(bend+centerPull*.48)*u_dispersion;
  float blur=u_blur*scale*(1.-press*.15);
  blur*=mix(.32,1.48,smoothstep(.65,4.,blur));
  vec3 soft=sampleSoft(at,blur);
  vec3 lens=soft;
  if(u_dispersion>0.)lens=vec3(sampleSoft(at-split,blur).r,soft.g,sampleSoft(at+split,blur).b);
  float luma=dot(lens,vec3(.2126,.7152,.0722));
  lens=mix(vec3(luma),lens,u_vibrancy);
  lens+=u_brightness;
  lens=mix(lens,mix(vec3(luma),soft,1.35),clamp(u_pickup,0.,1.));
  lens=mix(lens,u_tint,u_tintAmount);
  lens=mix(lens,vec3(luma),clamp(u_frost*.12,0.,.18));
  vec2 light=vec2(cos(radians(u_lightAngle)),sin(radians(u_lightAngle)));
  float facing=dot(n,light);
  rim=1.-smoothstep(0.,max(u_rimWidth,.35)*2.25,abs(field));
  shine=rim*u_specular*(.30+1.05*pow(max(facing,0.),1.65)+.92*pow(max(-facing,0.),2.));
  float glint=(1.-smoothstep(.22,1.65,max(-field,0.)))
      *min(1.,u_specular*1.45)*(.72+.28*abs(facing))*(1.-u_dim*.42);
  lens=mix(lens,vec3(1.),clamp(max(shine,glint),0.,.91));
  vec2 delta=(p-contact)/contactRadius;
  float touch=exp(-dot(delta,delta))*press;
  lens+=press*.04+touch*.17;
  float autoMode=1.-smoothstep(.33,.68,luma);
  float mode=u_appearance<.5?1.:u_appearance<1.5?0.:autoMode;
  // Haze and blur are independent. Clear lenses retain the source colors.
  float haze=clamp(u_frost*(.50+.40*mode),0.,.65);
  lens=mix(lens,mix(soft,vec3(1.),.52),haze);
  lens*=1.-(1.-mode)*u_frost*.12-u_dim*.58;
  return lens;
}
void main(){
  vec2 p=vec2(gl_FragCoord.x,u_bufferSize.y-gl_FragCoord.y)*u_size/u_bufferSize;
  vec4 dynamics;
  vec2 contact;
  float sliderPress,movement,junction,menuWeight;
  vec2 dome;
  vec4 merged=fieldAt(p,dynamics,contact,sliderPress,movement,junction,dome,menuWeight);
  float field=merged.x,scale=dynamics.z,press=dynamics.w;
  bool hasTheme=u_themeShape>=0&&u_themeBase.w>0.;
  float themeDistance=1e5,themeWeight=0.;
  if(hasTheme){
    themeDistance=shapeDistance(p,u_themeShape);
    // Join the movable lens to the thumb. The track stays in the sampled backdrop.
    float merge=dome.x>.5&&menuWeight<.5?max(u_merge,0.)*(1.+.65*max(press,u_press[u_themeShape])):0.;
    if(merge>.001){
      themeWeight=clamp(.5+.5*(field-themeDistance)/merge,0.,1.);
      float neck=merge*themeWeight*(1.-themeWeight);
      field=mix(field,themeDistance,themeWeight)-neck;
      junction=max(junction,neck);
    }else if(themeDistance<field){
      field=themeDistance;
      themeWeight=1.;
    }
  }
  vec2 centre=dynamics.xy;
  float contactRadius=max(30.,scale*62.);
  vec2 gradient=vec2(dFdx(field),-dFdy(field));
  float aa=menuWeight>.5?.65:max(.08,length(gradient)*.58);
  vec3 base=sampleAt(p)*(1.-u_dim);
  vec3 themeLens=vec3(0.);
  if(hasTheme){
    vec4 thumb=u_shapes[u_themeShape];
    vec2 q=p-thumb.xy;
    vec2 light=vec2(cos(radians(u_themeLight)),sin(radians(u_themeLight)));
    float direction=dot(normalize(q/thumb.zw+vec2(.00001)),light);
    float arc=smoothstep(.20,.39,direction);
    float line=themeDistance-2.8;
    float spill=arc*(.32*exp(-abs(line)/3.3)+.28*exp(-abs(line)/12.)+.16*exp(-abs(line)/27.));
    vec3 glow=u_themeGlow;
    vec3 core=mix(glow,vec3(1.),.76);
    float filament=(1.-smoothstep(.34,1.05,abs(line)))*arc*smoothstep(0.,2.3,field);
    base*=1.-.34*exp(-max(themeDistance-1.7,0.)/5.8);
    base=mix(base,glow,spill);
    base=mix(base,core,filament*.97);
    if(field<aa&&themeWeight>0.){
      vec2 n=normalize(gradient+vec2(.00001));
      float depth=max(-field,0.);
      float bevel=sin(clamp(depth/9.,0.,1.)*3.141593);
      vec2 ray=p-q*.075-n*bevel*(5.+u_press[u_themeShape]*2.);
      vec3 lens=sampleSoft(ray,1.9);
      lens.r=sampleSoft(ray-n*bevel*.85,1.9).r;
      lens.b=sampleSoft(ray+n*bevel*.85,1.9).b;
      lens=mix(lens,mix(vec3(.16,.17,.21),vec3(.97,.96,.93),u_themeTint),.62);
      float transmission=smoothstep(-.12,.96,direction);
      lens=mix(lens,glow,transmission*(.64*exp(-depth/8.5)+.19));
      float sheen=exp(-depth/2.6)*(.21+.37*transmission);
      float rim=(1.-smoothstep(.08,1.15,depth))*(.16+.80*arc);
      lens=mix(lens,core,sheen);
      lens=mix(lens,mix(vec3(.79,.82,.89),core,arc),rim);
      themeLens=lens;
      if(themeWeight>=1.){
        color=compositeGlass(base,lens,1.-smoothstep(-aa,aa,field));
        return;
      }
    }
  }
  float shadow=exp(-max(field,0.)/8.)*u_shadow*.22*(1.-merged.y)*(1.-themeWeight);
  if(field>aa){
    if(u_controlLayer){
      float baseCoverage=max(baseMask(p,u_switchBase,.5),baseMask(p,u_segmentBase,.5));
      float r=u_sliderTrack.w*.5;
      if(r>0.)baseCoverage=max(baseCoverage,trackMask(p,u_sliderTrack.x+r,u_sliderTrack.x+u_sliderTrack.z-r,r,.5));
      if(baseCoverage<=0.){color=vec4(0.,0.,0.,shadow);return;}
    }
    // Exact export also paints the backdrop inside deep notches in the button's box.
    bool inButtonBox=u_count==1&&all(lessThanEqual(abs(localGlassVector(p-u_shapes[0].xy,0)),u_shapes[0].zw*.5));
    bool transparent=u_surfaceOnly&&!u_controlLayer&&(!u_exactBackdrop||(field>56.&&!inButtonBox));
    color=transparent?vec4(0.):vec4(base*(1.-shadow),1.);
    return;
  }
  vec2 n=length(gradient)>.001?normalize(gradient):normalize(p-centre+vec2(.0001));
  float mask=1.-smoothstep(-aa,aa,field);
  float depth=max(-field,0.);
  float facingRim=abs(dot(n,vec2(-.7071,-.7071)));
  float rimBias=.54+.46*facingRim;
  float outline=(1.-smoothstep(.35,1.55,depth))*min(.85,u_specular)
      *rimBias;
  if(u_clearControls>.5){
    float curve=sin(clamp(depth/18.,0.,1.)*3.141593);
    vec2 pull=(p-centre)*press*.09;
    float knob=clamp(merged.y+merged.z+merged.w,0.,1.);
    float standalone=1.-knob;
    float engagement=1.-(1.-press)*(1.-smoothstep(.025,.44,movement));
    float neck=smoothstep(.10,2.2,junction);
    float neckDepth=1.-smoothstep(12.,31.,depth);
    float join=neck*neckDepth;
    float envelope=smoothstep(0.,3.,depth)*(1.-smoothstep(12.,29.,depth));
    // Bend the sampled backdrop around the new common contour, including fixed rails.
    vec2 neckBend=n*envelope*join*min(20.,u_refraction*.98);
    float spectralBend=min(u_refraction/18.,2.)*(standalone*(1.25+press*2.5)+join*.8);
    vec3 clear=liquidLens(p-pull+neckBend,n,field,max(engagement,join*.82),true,spectralBend);
    if(u_presetOptics>.5){
      float presetRim,presetShine;
      vec2 presetSample;
      clear=presetLens(p+neckBend,centre,n,field,scale,press,contact,contactRadius,presetRim,presetShine,presetSample);
    } else if(dome.x>.001){
      // A convex drop magnifies across its body. Its rim gathers light separately.
      float radius=max(1.,dome.y/dome.x);
      vec2 radial=p-centre;
      float r=clamp(length(radial)/radius,0.,1.);
      float power=min(1.5,u_refraction/18.);
      float zoom=(.24+press*.09)*power*(.83+.17*r*r);
      vec2 ray=p-radial*zoom+neckBend*.74;
      float edge=1.-smoothstep(0.,max(1.,radius*.25),depth);
      float spread=power*(.65+press*.8)*edge;
      vec3 water=sampleSoft(ray,.55);
      water.r=sampleSoft(ray-n*spread,.55).r;
      water.b=sampleSoft(ray+n*spread,.55).b;
      float facing=.38+.62*abs(dot(n,normalize(vec2(-.7,-.72))));
      float shoulder=1.-smoothstep(0.,min(7.,radius*.15),depth);
      float caustic=shoulder*shoulder*facing;
      vec3 gathered=mix(sampleSoft(p+n*(3.+radius*.12),2.2),vec3(1.),.70);
      water=mix(water,gathered,caustic*(.65+.19*press));
      clear=mix(clear,water,dome.x);
    }
    if(merged.w>.001 && u_segmentBase.w>0. && u_presetOptics<.5){
      // The held selector magnifies the track vertically into the capsule.
      // An inward ray keeps the bright backdrop from appearing as two hard bars.
      vec2 railRay=p-(p-centre)*vec2(.07,.24)*engagement;
      railRay-=n*curve*min(3.4,u_refraction*.19)*engagement;
      vec3 railLens=sampleSoft(railRay+neckBend*.55,1.5);
      float innerGlow=exp(-depth/4.4);
      float pinLight=1.-smoothstep(.24,1.8,depth);
      float direction=.62+.38*abs(dot(n,normalize(vec2(-.66,-.75))));
      float sheen=max(innerGlow*.26,pinLight*.64)*direction;
      railLens=mix(railLens,vec3(1.),sheen);
      clear=mix(clear,railLens,merged.w*(1.-join*.70)*engagement);
    }
    if(join>.005){
      // The curved neck collects a wider footprint than the ordinary rim.
      vec2 neckRay=p-pull+neckBend+n*envelope*u_refraction*.34;
      clear=mix(clear,sampleSoft(neckRay,2.4),join*envelope*.54);
    }
    // Broaden the rim into a soft caustic that inherits the sampled light.
    float innerFocus=smoothstep(.35,2.8,depth)*(1.-smoothstep(3.2,10.5,depth));
    vec3 rimLight=sampleSoft(p-pull+neckBend+n*4.,1.7);
    float facing=.45+.55*abs(dot(n,normalize(vec2(-.72,-.68))));
    vec3 caustic=mix(rimLight,vec3(1.),.74);
    clear=mix(clear,caustic,join*innerFocus*facing*.80);
    // Only the thumb and selection carry a resting pale fill. The same union
    // blends that fill into the clear glass and removes the internal rim.
    float restingFill=.97*merged.y+merged.z+.82*merged.w;
    float milk=restingFill*(1.-smoothstep(0.,1.,engagement))*(1.-join*.88);
    vec3 ivory=mix(vec3(.98,.987,.98),sampleSoft(p,2.),.10+.23*merged.w);
    float innerRim=1.-smoothstep(.45,2.5,depth);
    float selectionShoulder=merged.w*.15*exp(-depth/5.0);
    ivory=mix(ivory,vec3(1.),max(innerRim*.85,selectionShoulder));
    // The switch rests on a clean porcelain surface, then reveals the lens on hold.
    vec3 porcelain=mix(vec3(.945,.941,.928),vec3(.977,.914,.890),u_switchOn);
    float porcelainRim=1.-smoothstep(1.1,3.1,depth);
    ivory=mix(ivory,mix(porcelain,vec3(1.),porcelainRim),merged.z);
    clear=mix(clear,ivory,milk);
    // A stationary hold changes exposure and refraction; only travel adds chromatic light.
    vec2 delta=(p-contact)/contactRadius;
    float illumination=press*(.025+mix(.25,.035,knob)*exp(-dot(delta,delta)));
    illumination+=standalone*press*innerFocus*facing*.22;
    clear=mix(clear,vec3(1.),illumination);
    if(movement>.005){
      vec2 split=n*curve*movement*3.2;
      clear.r+=(sampleAt(p-pull-split).r-sampleAt(p-pull).r)*.65;
      clear.b+=(sampleAt(p-pull+split).b-sampleAt(p-pull).b)*.65;
      float rim=1.-smoothstep(0.,max(2.,u_rimWidth*3.),depth);
      float angle=.5+.5*dot(n,normalize(vec2(-.8,-.55)));
      vec3 tint=mix(vec3(.29,.77,1.),vec3(.86,1.,.68),angle);
      clear=mix(clear,tint,movement*(rim*.48+curve*.13));
    }
    if(menuWeight>.001){
      vec2 ray=p+(p-centre)*.06+n*curve*min(7.,u_refraction*.4);
      vec3 blurred=sampleSoft(ray,9.);
      float lift=.27+.28*(1.-smoothstep(.12,.50,dot(blurred,vec3(.2126,.7152,.0722))));
      vec3 softened=mix(blurred,vec3(.92,.98,.86),lift);
      float edgeLight=exp(-depth/3.8)*(.26+.48*facingRim);
      clear=mix(clear,mix(softened,vec3(1.),edgeLight),menuWeight*.92);
    }
    clear=mix(clear,vec3(1.),outline*(1.-join*.55));
    color=compositeGlass(base,clamp(mix(clear,themeLens,themeWeight),0.,1.),mask);
    return;
  }
  if(merged.y>.999){
    color=compositeGlass(base,liquidLens(p,n,field,sliderPress,false,0.),mask);
    return;
  }
  float rim,shine;
  vec2 at;
  vec3 lens=presetLens(p,centre,n,field,scale,press,contact,contactRadius,rim,shine,at);
  if(merged.z>.001){
    vec3 knob=mix(sampleSoft(at,2.),vec3(.99),.88-press*.47);
    lens=mix(lens,mix(knob,vec3(1.),rim*.57),merged.z);
  }
  if(merged.w>.001){
    vec3 selection=mix(sampleSoft(at,3.),vec3(.91,.93,.92),.58-press*.24);
    lens=mix(lens,mix(selection,vec3(1.),rim*(.22+shine*.67)),merged.w);
  }
  if(merged.y>.001)lens=mix(lens,liquidLens(p,n,field,sliderPress,false,0.),merged.y);
  vec3 outside=base*(1.-shadow);
  color=compositeGlass(outside,clamp(mix(lens,themeLens,themeWeight),0.,1.),mask);
}`;

export const PRESETS = {
  apple: { name: 'Apple Liquid Glass', refraction: 18, bezel: 20, magnify: 1, dispersion: 0.04, edge: 'convex', sizeScale: true, blur: 6, frost: 0.1, vibrancy: 1.35, brightness: 0.02, dim: 0, appearance: 'auto', pickup: 0.35, tintAmount: 0, tint: '#e8593c', specular: 0.7, rimWidth: 1.4, lightAngle: -135, shadow: 0.3, merge: 10, interactive: true },
  clear: { name: 'Apple clear', refraction: 18, bezel: 16, magnify: 1, dispersion: 0.05, edge: 'convex', sizeScale: true, blur: 0.5, frost: 0.02, vibrancy: 1.1, brightness: 0, dim: 0.35, appearance: 'light', pickup: 0.1, tintAmount: 0, tint: '#e8593c', specular: 0.65, rimWidth: 1.4, lightAngle: -135, shadow: 0.18, merge: 10, interactive: true },
  thick: { name: 'Thick lens', refraction: 46, bezel: 44, magnify: 1.28, dispersion: 0.12, edge: 'convex', sizeScale: false, blur: 0, frost: 0, vibrancy: 1.05, brightness: 0.02, dim: 0, appearance: 'light', pickup: 0, tintAmount: 0, tint: '#e8593c', specular: 0.8, rimWidth: 2.2, lightAngle: -135, shadow: 0.45, merge: 24, interactive: true },
  frosted: { name: 'Frosted', refraction: 8, bezel: 12, magnify: 1, dispersion: 0, edge: 'convex', sizeScale: true, blur: 22, frost: 0.3, vibrancy: 1.4, brightness: 0.04, dim: 0, appearance: 'auto', pickup: 0.6, tintAmount: 0, tint: '#e8593c', specular: 0.35, rimWidth: 1, lightAngle: -135, shadow: 0.25, merge: 14, interactive: true },
  plain: { name: 'Plain lens', refraction: 26, bezel: 22, magnify: 1.06, dispersion: 0, edge: 'convex', sizeScale: false, blur: 0, frost: 0, vibrancy: 1, brightness: 0, dim: 0, appearance: 'light', pickup: 0, tintAmount: 0, tint: '#e8593c', specular: 0.5, rimWidth: 1, lightAngle: -135, shadow: 0.15, merge: 14, interactive: true },
  prism: { name: 'Prism', refraction: 30, bezel: 30, magnify: 1.1, dispersion: 0.85, edge: 'convex', sizeScale: false, blur: 0, frost: 0, vibrancy: 1.2, brightness: 0.02, dim: 0, appearance: 'light', pickup: 0, tintAmount: 0, tint: '#e8593c', specular: 0.9, rimWidth: 1.6, lightAngle: -135, shadow: 0.25, merge: 20, interactive: true }
};
const numeric = ['refraction','bezel','magnify','dispersion','blur','frost','vibrancy','brightness','dim','pickup','tintAmount','specular','rimWidth','lightAngle','shadow','merge'];
const ranges = { refraction:[0,80],bezel:[1,80],magnify:[1,1.8],dispersion:[0,1],blur:[0,40],frost:[0,1],vibrancy:[0,2],brightness:[-.3,.3],dim:[0,.6],pickup:[0,1],tintAmount:[0,1],specular:[0,1.5],rimWidth:[.3,12],lightAngle:[-180,180],shadow:[0,1],merge:[0,60] };
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const hexToRgb=hex=>{const n=Number.parseInt(String(hex).replace('#',''),16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];};

export function normalizeGlassOutline(outline) {
  if (!Array.isArray(outline) || outline.length<3 || outline.length>64) return undefined;
  return outline.every(point=>Array.isArray(point)&&point.length===2
    && point.every(value=>Number.isFinite(value)&&value>=0&&value<=1)) ? outline : undefined;
}

export function normalizeGlassRotation(value) {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value%360)*10)/10;
  const angle = ((rounded+540)%360)-180;
  return angle===-180 && rounded>0 ? 180 : Math.round(angle*10)/10;
}

export class GlassScene {
  constructor(canvas, options = {}) {
    this.canvas=canvas; this.shapes=[]; this.sliderTrack=null; this.controlBases={}; this.material={...PRESETS.apple}; this.available=false; this.destroyed=false; this.source=null;
    this.backdropDim=0;
    this.gl=canvas.getContext('webgl2',{alpha:options.surfaceOnly===true||options.controlLayer===true,premultipliedAlpha:false,antialias:false});
    // `ready` resolves to `available` once the program is linked. Asking for COMPILE_STATUS or
    // LINK_STATUS straight after compiling makes the main thread wait for the GPU driver: this
    // fragment shader took seconds to link on an integrated GPU, frozen page included. With
    // KHR_parallel_shader_compile the compile runs in the background and is polled without
    // blocking (COMPLETION_STATUS_KHR) once a frame; the status is read only when it is done.
    if(!this.gl){this.ready=Promise.resolve(false);return;}
    const gl=this.gl, shaders=[];
    try {
      for(const [type,code] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,code);gl.compileShader(shader);}
      this.program=gl.createProgram();shaders.forEach(shader=>gl.attachShader(this.program,shader));gl.linkProgram(this.program);
    } catch(error){this.error=error.message;shaders.forEach(shader=>gl.deleteShader(shader));this.destroy();this.ready=Promise.resolve(false);return;}
    const parallel=gl.getExtension('KHR_parallel_shader_compile');
    const finish=()=>{if(!this.destroyed)this.#setup(canvas,options,shaders);return this.available;};
    if(!parallel){this.ready=Promise.resolve(finish());return;}
    this.pending=true;
    this.ready=new Promise(resolve=>{
      const poll=()=>{
        if(this.destroyed){resolve(false);return;}
        if(!gl.getProgramParameter(this.program,parallel.COMPLETION_STATUS_KHR)){requestAnimationFrame(poll);return;}
        this.pending=false;resolve(finish());
      };
      requestAnimationFrame(poll);
    });
  }
  #setup(canvas,options,shaders){
    const gl=this.gl;
    try {
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)){
        const failed=shaders.find(shader=>!gl.getShaderParameter(shader,gl.COMPILE_STATUS));
        throw new Error(failed?gl.getShaderInfoLog(failed):gl.getProgramInfoLog(this.program));
      }
      gl.useProgram(this.program);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(this.program,'a_position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);for(const [key,value] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,value);
      this.outlines=gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,this.outlines);
      gl.texStorage2D(gl.TEXTURE_2D,1,gl.RG32F,64,MAX_GLASS_SHAPES);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.activeTexture(gl.TEXTURE0);
      const names=['outlines','outlineCount[0]','surfaceOnly','exactBackdrop','size','bufferSize','sourceSize','source','count','shapes[0]','radii[0]','rotation[0]','press[0]','surface[0]','motion[0]','stretch[0]','contact[0]','sliderTrack','sliderFill','clearControls','presetOptics','switchBase','segmentBase','switchOn','themeBase','themeShape','themeLight','themeTint','themeGlow','refraction','bezel','magnify','dispersion','edge','sizeScale','blur','frost','vibrancy','brightness','dim','appearance','pickup','tintAmount','tint','specular','rimWidth','lightAngle','shadow','merge'];
      names.push('controlLayer','backdropDim');
      this.uniforms=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(this.program,`u_${name}`)]));
      gl.uniform1i(this.uniforms.surfaceOnly,options.surfaceOnly?1:0);
      gl.uniform1i(this.uniforms.exactBackdrop,options.exactBackdrop?1:0);
      gl.uniform1i(this.uniforms.controlLayer,options.controlLayer?1:0);
      this.available=true;this.setMaterial(options);
      this.observer=new ResizeObserver(()=>this.render());this.observer.observe(canvas);
      this.contextLost=event=>{event.preventDefault();this.available=false;canvas.dispatchEvent(new Event('glassfallback'));};canvas.addEventListener('webglcontextlost',this.contextLost);
    } catch(error){this.error=error.message;this.destroy();} finally {shaders.forEach(shader=>gl.deleteShader(shader));}
  }
  setShapes(shapes){this.shapes=shapes.slice(0,MAX_GLASS_SHAPES).map(s=>{const width=Math.max(1,Number(s.width)||1),height=Math.max(1,Number(s.height)||1);return{x:Number(s.x)||0,y:Number(s.y)||0,width,height,radius:clamp(Number(s.radius)||0,0,Math.min(width,height)/2),press:clamp(Number(s.press)||0,0,1),slider:s.slider===true,motion:clamp(Number(s.motion)||0,0,1),surface:s.surface,rotation:normalizeGlassRotation(s.rotation),outline:normalizeGlassOutline(s.outline),contactX:Number.isFinite(s.contactX)?s.contactX:Number(s.x)||0,contactY:Number.isFinite(s.contactY)?s.contactY:Number(s.y)||0,stretchX:clamp(Number(s.stretchX)||0,-48,48),stretchY:clamp(Number(s.stretchY)||0,-48,48)};});}
  setSliderTrack(track){
    this.sliderTrack=track && [track.x,track.y,track.width,track.height,track.fillX].every(Number.isFinite)
      && track.width>0 && track.height>0 ? {...track,height:Math.min(track.height,track.width)} : null;
  }
  setControlBases({ toggle, segment, theme } = {}){
    const copy = box => box && [box.x,box.y,box.width,box.height].every(Number.isFinite)
      && box.width>0 && box.height>0 ? {...box} : null;
    this.controlBases={toggle:copy(toggle),segment:copy(segment),theme:copy(theme)};
  }
  setMaterial(values={}){
    if(typeof values.presetOptics==='boolean')this.material.presetOptics=values.presetOptics;
    if(typeof values.clearControls==='boolean')this.material.clearControls=values.clearControls;
    for(const key of numeric)if(Number.isFinite(values[key]))this.material[key]=clamp(values[key],...ranges[key]);
    if(values.edge==='lip'||values.edge==='convex')this.material.edge=values.edge;
    if(['auto','light','dark'].includes(values.appearance))this.material.appearance=values.appearance;
    if(typeof values.sizeScale==='boolean')this.material.sizeScale=values.sizeScale;
    if(typeof values.interactive==='boolean')this.material.interactive=values.interactive;
    if(typeof values.tint==='string'&&/^#[0-9a-f]{6}$/i.test(values.tint))this.material.tint=values.tint;
  }
  setSource(source){
    if(!this.available||this.destroyed)return false;const gl=this.gl;const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;if(!width||!height)throw new Error('Load the glass source before setSource().');
    gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.generateMipmap(gl.TEXTURE_2D);this.sourceSize=[width,height];this.source=source;return true;
  }
  setBackdropDim(opacity) {
    if (Number.isFinite(opacity)) this.backdropDim=clamp(opacity,0,1);
  }
  render(){
    if(!this.available||this.destroyed||!this.source)return;const gl=this.gl,box=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    const cssWidth=Math.max(1,box.width),cssHeight=Math.max(1,box.height);
    // Keep optics in CSS pixels while sampling the silhouette at device resolution.
    const scale=Math.max(1,Math.min(dpr,Math.sqrt(2500000/(cssWidth*cssHeight))));
    const width=Math.round(cssWidth*scale),height=Math.round(cssHeight*scale);if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}gl.viewport(0,0,width,height);gl.useProgram(this.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.uniform1i(this.uniforms.source,0);gl.uniform2f(this.uniforms.size,cssWidth,cssHeight);gl.uniform2f(this.uniforms.bufferSize,width,height);gl.uniform2fv(this.uniforms.sourceSize,this.sourceSize);gl.uniform1i(this.uniforms.count,this.shapes.length);
    gl.uniform1f(this.uniforms.backdropDim,this.backdropDim);
    const shapes=new Float32Array(48),radii=new Float32Array(12),press=new Float32Array(12),surfaces=new Float32Array(12),motions=new Float32Array(12),stretch=new Float32Array(24),contacts=new Float32Array(24),rotation=new Float32Array(24);this.shapes.forEach((s,i)=>{const angle=s.rotation*Math.PI/180;rotation.set([Math.cos(angle),Math.sin(angle)],i*2);shapes.set([s.x,s.y,s.width,s.height],i*4);radii[i]=s.radius;press[i]=s.press;motions[i]=s.motion;surfaces[i]=s.slider?1:s.surface==='switch'?2:s.surface==='selection'?3:s.surface==='lens'?4:s.surface==='menu'?5:s.surface==='theme'?6:0;stretch.set([s.stretchX,s.stretchY],i*2);contacts.set([s.contactX,s.contactY],i*2);});gl.uniform4fv(this.uniforms['shapes[0]'],shapes);gl.uniform1fv(this.uniforms['radii[0]'],radii);gl.uniform2fv(this.uniforms['rotation[0]'],rotation);gl.uniform1fv(this.uniforms['press[0]'],press);gl.uniform1fv(this.uniforms['surface[0]'],surfaces);gl.uniform1fv(this.uniforms['motion[0]'],motions);gl.uniform2fv(this.uniforms['stretch[0]'],stretch);gl.uniform2fv(this.uniforms['contact[0]'],contacts);
    const outlineCounts=Int32Array.from({length:MAX_GLASS_SHAPES},(_,i)=>this.shapes[i]?.outline?.length??0);
    gl.uniform1i(this.uniforms.outlines,1);
    gl.uniform1iv(this.uniforms['outlineCount[0]'],outlineCounts);
    if(outlineCounts.some(Boolean)){
      const vertices=new Float32Array(64*MAX_GLASS_SHAPES*2);
      this.shapes.forEach((shape,i)=>shape.outline?.forEach((point,j)=>vertices.set(point,(i*64+j)*2)));
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,this.outlines);
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,64,MAX_GLASS_SHAPES,gl.RG,gl.FLOAT,vertices);
      gl.activeTexture(gl.TEXTURE0);
    }
    const {toggle,segment,theme}=this.controlBases;
    const base=(key,b)=>gl.uniform4f(this.uniforms[key],(b?.x??0),(b?.y??0),(b?.width??0),(b?.height??0));
    base('switchBase',toggle);base('segmentBase',segment);base('themeBase',theme);
    gl.uniform1f(this.uniforms.switchOn,toggle?.on?1:0);gl.uniform1i(this.uniforms.themeShape,this.shapes.findIndex(shape=>shape.surface==='theme'));
    const themeLight=Number.isFinite(theme?.light)?theme.light:-135;
    gl.uniform1f(this.uniforms.themeLight,themeLight);
    gl.uniform1f(this.uniforms.themeTint,Number.isFinite(theme?.tint)?clamp(theme.tint,0,1):0);
    gl.uniform3fv(this.uniforms.themeGlow,Array.isArray(theme?.glow)&&theme.glow.every(Number.isFinite)?theme.glow:[.455,.51,1]);
    const track=this.sliderTrack;
    gl.uniform4f(this.uniforms.sliderTrack,(track?.x??0),(track?.y??0),(track?.width??0),(track?.height??0));
    gl.uniform1f(this.uniforms.presetOptics,this.material.presetOptics?1:0);
    gl.uniform1f(this.uniforms.clearControls,this.material.clearControls?1:0);
    gl.uniform1f(this.uniforms.sliderFill,(track?.fillX??0));
    const m=this.material;for(const key of numeric)gl.uniform1f(this.uniforms[key],m[key]);
    gl.uniform1f(this.uniforms.edge,m.edge==='lip'?1:0);gl.uniform1f(this.uniforms.sizeScale,m.sizeScale?1:0);gl.uniform1f(this.uniforms.appearance,m.appearance==='light'?0:m.appearance==='dark'?1:2);gl.uniform3fv(this.uniforms.tint,hexToRgb(m.tint));gl.drawArrays(gl.TRIANGLES,0,6);
  }
  destroy(){this.observer?.disconnect();if(this.contextLost)this.canvas.removeEventListener('webglcontextlost',this.contextLost);if(this.gl){if(this.texture)this.gl.deleteTexture(this.texture);if(this.outlines)this.gl.deleteTexture(this.outlines);if(this.buffer)this.gl.deleteBuffer(this.buffer);if(this.program)this.gl.deleteProgram(this.program);}this.available=false;this.destroyed=true;}
}
