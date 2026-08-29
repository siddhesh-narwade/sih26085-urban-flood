# Scientific Assumptions & Governing Hydrologic Equations — SIH 26085

## 1. Rainfall-to-Runoff Generation

### Modified Rational Formulation
Surface runoff rate $Q_{\text{runoff}}$ ($m^3/s$) for each urban street catchment is computed as:
$$Q_{\text{runoff}}(i, t) = \frac{C_i \cdot I(x_i, y_i, t) \cdot A_i}{3.6 \times 10^6}$$
- $C_i$: Dimensionless composite runoff coefficient ($0.75 - 0.90$ for dense urban paved concrete/asphalt).
- $I(x_i, y_i, t)$: Instantaneous spatial rainfall intensity ($mm/hr$) interpolated at the catchment centroid.
- $A_i$: Tributary contributing catchment area ($m^2$), including direct roadway and adjacent building roofs/pavements.

### Spatial Convective Storm Decay
Spatial rainfall distribution across the basin follows a 2D Gaussian decay from the moving convective storm core $(x_c(t), y_c(t))$:
$$I(x, y, t) = I_{\text{peak}}(t) \cdot \exp\left( -\frac{(x - x_c)^2 + (y - y_c)^2}{2 \sigma^2} \right)$$
where $\sigma$ is the convective storm radius ($2.5\text{ km}$).

---

## 2. Stormwater Conduit Hydraulics

### Manning's Equation for Gravity Flow
For a full circular conduit of diameter $D$ ($m$):
$$Q_{\text{capacity}} = \frac{1}{n} \cdot A \cdot R_h^{2/3} \cdot S^{1/2}$$
- $n$: Manning's roughness coefficient ($0.013$ for smooth reinforced concrete).
- $A = \frac{\pi D^2}{4}$: Cross-sectional area ($m^2$).
- $R_h = \frac{D}{4}$: Hydraulic radius ($m$).
- $S$: Bed slope of the conduit ($m/m$), constrained to $S \ge 0.0015$ ($0.15\%$).

### Non-Linear Debris Blockage Model
Silt, solid waste, and plastic obstruction reduce the effective flow area and dramatically increase wall boundary turbulence:
$$Q_{\text{effective}} = Q_{\text{capacity}} \cdot (1 - \beta)^{1.5}$$
where $\beta \in [0.0, 0.9]$ is the blockage fraction ($0\% - 90\%$).

### Tidal Backwater Head Attenuation
At outfalls discharging into the tidal Mithi River, downstream high tide level $H_{\text{tide}}$ reduces gravity discharge:
$$\eta_{\text{tide}} = \max\left(0.15, 1.0 - \frac{\max(0, H_{\text{tide}} - Z_{\text{invert}})}{2.5}\right)$$
$$Q_{\text{outfall}} = Q_{\text{effective}} \cdot \eta_{\text{tide}}$$

---

## 3. Inlet Interception & Surcharge Backflow

### Gutter Inlet Interception
A street drop inlet captures a fraction of approach overland flow up to its grate capacity:
$$Q_{\text{captured}}(i, t) = \min(Q_{\text{runoff}}(i, t) \cdot 0.80, Q_{\text{grate\_capacity}})$$

### Overcapacity Surcharge Formulation
When total inflow $Q_{\text{inflow}}$ entering junction node $v$ exceeds total downstream conduit capacity $\sum Q_{\text{effective}}$:
$$Q_{\text{surcharge}}(v, t) = Q_{\text{inflow}}(v, t) - \sum Q_{\text{effective}}$$
Surcharged water spills upward through manhole covers back onto the street surface node at rate $Q_{\text{surcharge}}$.

---

## 4. Street-Level Inundation Depth (cm)

### Mass-Balance Formulation
Water volume $V_i(t)$ ($m^3$) on street segment $i$ is tracked across discrete timesteps $\Delta t$ ($600\text{ s}$):
$$V_i(t + \Delta t) = \max\left(0, V_i(t) + \left[ Q_{\text{net\_surface}}(i, t) - Q_{\text{recession}}(i) \right] \cdot \Delta t \right)$$
$$Q_{\text{net\_surface}} = \begin{cases}
Q_{\text{runoff}} + Q_{\text{surcharge}} \cdot 0.90, & \text{if surcharged} \\
Q_{\text{runoff}} - Q_{\text{captured}} + Q_{\text{topo\_inflow}}, & \text{if normal}
\end{cases}$$

### Water Depth Calculation
$$d_i(t) = \frac{V_i(t)}{A_{\text{road\_surface}}} \times 100 \times \kappa_{\text{pool}} \quad (\text{cm})$$
where $\kappa_{\text{pool}} = \max(0.7, 1.5 - \frac{Z_i}{8.0})$ is the topographic bowl concentration factor.

---

## 5. Dynamic Flood-Aware Routing Weight Function

For an emergency vehicle with maximum water clearance threshold $\Omega_{\text{veh}}$ (e.g. Ambulance: $20\text{ cm}$, Fire Engine: $45\text{ cm}$):
$$W_e(t, \text{Vehicle}) = \begin{cases}
T_{\text{base}}(e) \cdot \left(1 + \gamma_{\text{veh}} \cdot \left(\frac{d_e(t)}{\Omega_{\text{veh}}}\right)^2\right), & \text{if } d_e(t) \le \Omega_{\text{veh}} \\
\infty \text{ (Closed / Impassable Hazard)}, & \text{if } d_e(t) > \Omega_{\text{veh}}
\end{cases}$$
where $T_{\text{base}}(e) = \frac{L_e}{V_{\text{speed}}}$ is free-flow travel time, and $\gamma_{\text{veh}}$ is the hydrodynamic drag penalty coefficient ($2.0 - 5.0$).
